import type { TenantEventParticipantSnapshot } from "@/lib/participantGroupCounts";

function getAppBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim();
  const withProto = /^https?:\/\//.test(raw) ? raw : "https://" + raw;
  return withProto.replace(/\/$/, "");
}

/**
 * 텔레그램 미니앱 딥링크 베이스 URL을 반환한다.
 * - NEXT_PUBLIC_TELEGRAM_WEBAPP_OPEN_URL 이 t.me/... 형태면 그걸 사용
 * - 없으면 NEXT_PUBLIC_TELEGRAM_BOT_NAME + NEXT_PUBLIC_TELEGRAM_MINI_APP_SHORT_NAME 조합
 * - 둘 다 없으면 null (직접 URL 사용)
 */
function getMiniAppBase(): string | null {
  const openUrl = process.env.NEXT_PUBLIC_TELEGRAM_WEBAPP_OPEN_URL?.trim();
  if (openUrl) {
    try {
      const u = new URL(openUrl);
      if (u.hostname === "t.me" || u.hostname === "telegram.me" || u.hostname === "www.telegram.me") {
        return openUrl.replace(/\/+$/, "");
      }
    } catch { /* invalid URL */ }
  }
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME?.trim();
  const short = process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_SHORT_NAME?.trim();
  if (bot && short) {
    return `https://t.me/${encodeURIComponent(bot)}/${encodeURIComponent(short)}`;
  }
  return null;
}

/**
 * startapp 파라미터 인코딩.
 * - 이벤트 목록: `{tenantSlug}`
 * - 이벤트 상세: `{tenantSlug}-ev-{eventId}`
 * Telegram startapp 허용 문자: A-Z a-z 0-9 _ - (최대 64자)
 */
export function encodeStartParam(tenantSlug: string, eventId?: number | string): string {
  const slug = tenantSlug.replace(/[^A-Za-z0-9_-]/g, "_");
  if (eventId !== undefined) return `${slug}-ev-${Number(eventId)}`;
  return slug;
}

/** startapp 파라미터를 파싱해 tenantSlug · eventId 를 분리한다 */
export function parseStartParam(startParam: string): { tenantSlug: string; eventId?: string } {
  const match = startParam.match(/^(.+)-ev-(\d+)$/);
  if (match) return { tenantSlug: match[1], eventId: match[2] };
  return { tenantSlug: startParam };
}

/**
 * 이벤트 상세 링크.
 * 미니앱 환경 변수가 설정돼 있으면 t.me 딥링크, 없으면 직접 URL.
 */
export function eventDetailUrl(tenantSlug: string, eventId: number | string): string {
  const base = getMiniAppBase();
  if (base) {
    return `${base}?startapp=${encodeURIComponent(encodeStartParam(tenantSlug, eventId))}`;
  }
  return `${getAppBaseUrl()}/t/${encodeURIComponent(tenantSlug)}/events/${Number(eventId)}`;
}

/**
 * 이벤트 목록 링크.
 * 미니앱 환경 변수가 설정돼 있으면 t.me 딥링크, 없으면 직접 URL.
 */
export function eventListUrl(tenantSlug: string): string {
  const base = getMiniAppBase();
  if (base) {
    return `${base}?startapp=${encodeURIComponent(encodeStartParam(tenantSlug))}`;
  }
  return `${getAppBaseUrl()}/t/${encodeURIComponent(tenantSlug)}/events`;
}

export function escapeHtml(s: string | number | null | undefined): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 텔레그램 본문 하단 CTA (인라인 버튼 위 안내) */
const TELEGRAM_CLICK_FOOTER = "👇 클릭";
const TELEGRAM_CLICK_FOOTER_BLOCK = `\n\n${TELEGRAM_CLICK_FOOTER}`;

const TELEGRAM_HTML_SAFE_LEN = 3900;

function formatDelta(delta: number | null | undefined): string {
  if (delta == null || delta === 0) return "";
  return ` (${delta > 0 ? "+" : ""}${delta})`;
}

/** prefix 가 있으면 제목 앞에 공백 1칸을 두고 붙인다. 없으면 빈 문자열. */
function titleWithPrefix(ev: TenantEventParticipantSnapshot): string {
  const p = ev.titlePrefix?.trim();
  const head = p ? `${escapeHtml(p)} ` : "";
  return `${head}${escapeHtml(ev.eventTitle)}`;
}

function formatEventSnapshotBlock(ev: TenantEventParticipantSnapshot): string {
  // 각 블록은 앞에 빈 줄을 넣어 시각적으로 구분
  // 옵션 그룹이 2개 이상: 제목을 볼드로 한 줄, 그룹별 인원을 그 아래 들여쓰기로
  if (ev.lines.length > 0) {
    const sub: string[] = ["", "", `<b>${titleWithPrefix(ev)}</b>`];
    for (const L of ev.lines) {
      sub.push(`- ${escapeHtml(L.groupName)} ${L.count}명${formatDelta(L.delta)}`);
    }
    return sub.join("\n");
  }
  // 옵션 그룹이 0~1개: 한 줄로 '이벤트 제목 n명 (+1)'
  const tf = ev.totalFallback;
  const count = tf?.count ?? 0;
  return `\n\n${titleWithPrefix(ev)} ${count}명${formatDelta(tf?.delta)}`;
}

/**
 * 참가 인원 변동 알림 — 테넌트 활성 꼬리달기 전체 + 이벤트별 옵션 그룹(또는 전체) 인원.
 * (±n) 은 이번 신청/취소가 발생한 꼬리달기에만 붙음.
 */
export function buildParticipantTenantWideSummaryTelegramHtml(opts: {
  events: TenantEventParticipantSnapshot[];
  prefix?: string | null;
}): string {
  const raw = opts.prefix?.trim();
  const head = raw ? `${escapeHtml(raw)}\n` : "";
  const title = "<b>참가 인원 변동 알림</b>";
  const footer = TELEGRAM_CLICK_FOOTER_BLOCK;

  let body = "";
  let omitted = 0;
  const events = opts.events;
  for (let i = 0; i < events.length; i++) {
    const block = formatEventSnapshotBlock(events[i]);
    const would = head.length + title.length + body.length + block.length + footer.length;
    if (would > TELEGRAM_HTML_SAFE_LEN) {
      if (body.length === 0 && i === 0) {
        const room = TELEGRAM_HTML_SAFE_LEN - head.length - title.length - footer.length - 24;
        body += block.slice(0, Math.max(0, room)) + "\n…(일부 생략)";
      } else {
        omitted = events.length - i;
      }
      break;
    }
    body += block;
  }
  if (omitted > 0 && body.length > 0) {
    body += `\n…외 ${omitted}개 꼬리달기는 목록에서 확인`;
  }
  return `${head}${title}${body}${footer}`;
}

function buildOpenButton(text: string, openUrl: string) {
  // web_app 은 봇·사용자 1:1 채팅에서만 가능하고 URL 은 BotFather 에 등록한 HTTPS 여야 함.
  // 방 알림(chat_room_id)은 보통 그룹/채널이므로 url 버튼 사용 (t.me 딥링크·자체 HTTPS 모두 가능).
  return { text, url: openUrl };
}

/** event_notice_chat_room_id 컬럼만 사용(관리자 방송·인원 돌파 등) */
export function getEventNoticeChatRoomIdStrict(tenant: {
  event_notice_chat_room_id: string | null;
}): string | null {
  const id = (tenant.event_notice_chat_room_id ?? "").trim();
  if (!id || id === "-1") return null;
  return id;
}

export function parseMessageThreadId(value: number | string | null | undefined): number | undefined {
  if (value == null) return undefined;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return undefined;
  const threadId = Math.trunc(n);
  return threadId > 0 ? threadId : undefined;
}

/** chat_room_id 전송 시 message_thread_id */
export function getChatRoomThreadId(tenant: {
  chat_room_thread_id?: number | string | null;
}): number | undefined {
  return parseMessageThreadId(tenant.chat_room_thread_id);
}

/** event_notice 전용 방(폴백 없음) 전송 시 message_thread_id */
export function getEventNoticeChatRoomThreadIdStrict(tenant: {
  event_notice_chat_room_thread_id?: number | string | null;
}): number | undefined {
  return parseMessageThreadId(tenant.event_notice_chat_room_thread_id);
}

/** 참가자 10·20·30… 명 돌파 알림 */
export function buildParticipantMilestoneTelegramHtml(opts: {
  eventTitle: string;
  count: number;
}): string {
  const title = escapeHtml(opts.eventTitle);
  const n = opts.count;
  return `🎉 <b>[${title}]</b> 참가자 <b>${n}명</b> 돌파!`;
}

/** 관리자가 방에 직접 보내는 커스텀 알림(HTML). DB 저장 없음. 하단 버튼은 sendMessage 에서 목록 링크로 연결. */
export function buildAdminBroadcastTelegramHtml(opts: {
  body: string;
  headline?: string | null;
}): string {
  const rawBody = opts.body.trim();
  const body = escapeHtml(rawBody).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const footer = TELEGRAM_CLICK_FOOTER_BLOCK;
  const rawHead = opts.headline?.trim();
  if (rawHead) {
    return `<b>${escapeHtml(rawHead)}</b>\n\n${body}${footer}`;
  }
  return `${body}${footer}`;
}

export type SendMessageResult = { ok: true } | { ok: false; error: string };

export async function sendMessage(
  chatId: string | number | null | undefined,
  text: string,
  opts?: {
    buttonText?: string;
    webAppUrl?: string;
    /** Telegram forum topic thread id (message_thread_id) */
    messageThreadId?: number | null;
  },
): Promise<SendMessageResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "텔레그램 봇이 설정되지 않았습니다." };
  }
  const id = chatId == null ? "" : String(chatId).trim();
  if (!id || id === "-1") {
    return { ok: false, error: "이 지역에 연결된 텔레그램 채팅방이 없습니다." };
  }
  const messageThreadId = parseMessageThreadId(opts?.messageThreadId);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: id,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(messageThreadId != null ? { message_thread_id: messageThreadId } : {}),
        ...(opts?.webAppUrl
          ? {
              reply_markup: {
                inline_keyboard: [[buildOpenButton(opts.buttonText || "열기", opts.webAppUrl)]],
              },
            }
          : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[telegram] sendMessage failed:", res.status, body);
      let detail = "텔레그램 전송에 실패했습니다.";
      try {
        const parsed = JSON.parse(body) as { description?: string };
        if (parsed.description) detail = parsed.description;
      } catch {
        /* keep default */
      }
      return { ok: false, error: detail };
    }
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    console.error("[telegram] sendMessage error:", msg);
    return { ok: false, error: msg || "텔레그램 전송 중 오류가 발생했습니다." };
  }
}
