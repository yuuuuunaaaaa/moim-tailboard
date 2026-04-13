function getAppBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim();
  const withProto = /^https?:\/\//.test(raw) ? raw : "https://" + raw;
  return withProto.replace(/\/$/, "");
}

export function eventDetailUrl(tenantSlug: string, eventId: number | string): string {
  const base = getAppBaseUrl();
  return `${base}/t/${encodeURIComponent(tenantSlug)}/events/${Number(eventId)}`;
}

export function escapeHtml(s: string | number | null | undefined): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const DEFAULT_NEW_EVENT_HEADLINE = "새 이벤트가 생성되었습니다!";
const DEFAULT_PARTICIPANT_PREFIX = "👤 ";

function participantLeadPrefix(raw: string | null | undefined): string {
  const t = raw?.trim();
  if (!t) return DEFAULT_PARTICIPANT_PREFIX;
  return t.endsWith(" ") ? t : `${t} `;
}

/** 이벤트 최초 생성 시 1회 발송(폼 값만 사용, DB 저장 없음) */
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
  return `${escapeHtml(lead)}<b>${headline}</b>\n이벤트명: ${escapeHtml(opts.title)}\n${extra}<a href="${escapeHtml(opts.link)}">바로가기</a>`;
}

/** 참가 인원 변동 알림 */
export function buildParticipantCountTelegramHtml(opts: {
  eventTitle: string;
  link: string;
  count: number;
  deltaLabel: string;
  prefix: string;
}): string {
  const p = participantLeadPrefix(opts.prefix);
  return `${escapeHtml(p)}<b>${escapeHtml(opts.eventTitle)}</b>\n신청자 수: ${opts.count}명 (${opts.deltaLabel})\n<a href="${escapeHtml(opts.link)}">바로가기</a>`;
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
