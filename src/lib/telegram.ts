import type { TenantEventParticipantSnapshot } from "@/lib/participantGroupCounts";

function getAppBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim();
  const withProto = /^https?:\/\//.test(raw) ? raw : "https://" + raw;
  return withProto.replace(/\/$/, "");
}

export function eventDetailUrl(tenantSlug: string, eventId: number | string): string {
  const base = getAppBaseUrl();
  return `${base}/t/${encodeURIComponent(tenantSlug)}/events/${Number(eventId)}`;
}

/** 테넌트 꼬리달기(이벤트) 목록 화면 */
export function eventListUrl(tenantSlug: string): string {
  const base = getAppBaseUrl();
  return `${base}/t/${encodeURIComponent(tenantSlug)}/events`;
}

export function escapeHtml(s: string | number | null | undefined): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const DEFAULT_NEW_EVENT_HEADLINE = "새 꼬리달기가 생성되었습니다!";

/** 꼬리달기 최초 생성 시 1회 발송(폼 값만 사용, DB 저장 없음) */
export function buildNewEventTelegramHtml(opts: {
  title: string;
  link: string;
  notifyIcon?: string | null;
  notifyHeadline?: string | null;
  notifyExtra?: string | null;
}): string {
  const lead = `${opts.notifyIcon?.trim() || "📅"} `;
  const headline = escapeHtml(opts.notifyHeadline?.trim() || DEFAULT_NEW_EVENT_HEADLINE);
  const extraRaw = opts.notifyExtra?.trim();
  const extra = extraRaw
    ? `${escapeHtml(extraRaw).replace(/\r\n/g, "\n").replace(/\r/g, "\n")}\n`
    : "";
  return `${escapeHtml(lead)}<b>${headline}</b>\n꼬리달기명: ${escapeHtml(opts.title)}\n${extra}<a href="${escapeHtml(opts.link)}">바로가기</a>`;
}

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
  link: string;
  events: TenantEventParticipantSnapshot[];
  prefix?: string | null;
  linkLabel?: string;
}): string {
  const raw = opts.prefix?.trim();
  const head = raw ? `${escapeHtml(raw)}\n` : "";
  const title = "<b>참가 인원 변동 알림</b>";
  const anchor = escapeHtml(opts.linkLabel?.trim() || "꼬리달기 목록");
  const footer = `\n\n<a href="${escapeHtml(opts.link)}">${anchor}</a>`;

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

export async function sendMessage(chatId: string | number | null | undefined, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId || String(chatId) === "-1") return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn("[telegram] sendMessage failed:", body);
    }
  } catch (err) {
    console.warn("[telegram] sendMessage error:", (err as Error).message);
  }
}
