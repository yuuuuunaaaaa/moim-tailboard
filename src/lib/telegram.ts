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

/** 옵션 그룹(꼬리달기 별) 한 줄 — 변동이 있을 때만 delta 표시 */
export type TelegramParticipantGroupSummaryLine = {
  groupName: string;
  count: number;
  /** 0이 아닐 때만 메시지에 (±n) 붙음 */
  delta?: number;
};

/**
 * 참가 인원 변동 알림 — 그룹별 인원 요약
 *
 * 예:
 * 참가 인원 변동 알림
 * - 바자회 준비 3명(+1)
 * - 안내조 2명
 */
export function buildParticipantOptionSummaryTelegramHtml(opts: {
  link: string;
  lines: TelegramParticipantGroupSummaryLine[];
  /** 옵션 그룹이 하나도 없을 때 */
  totalFallback?: { count: number; delta?: number };
  /** 비어 있지 않으면 제목 위 한 줄(이모지·말머리 등) */
  prefix?: string | null;
}): string {
  const raw = opts.prefix?.trim();
  const lead = raw ? `${escapeHtml(raw)}\n` : "";
  const title = "<b>참가 인원 변동 알림</b>";
  const bullets: string[] = [];
  if (opts.lines.length > 0) {
    for (const L of opts.lines) {
      const d =
        L.delta != null && L.delta !== 0 ? `(${L.delta > 0 ? "+" : ""}${L.delta})` : "";
      bullets.push(`- ${escapeHtml(L.groupName)} ${L.count}명${d}`);
    }
  } else if (opts.totalFallback) {
    const tf = opts.totalFallback;
    const d =
      tf.delta != null && tf.delta !== 0 ? `(${tf.delta > 0 ? "+" : ""}${tf.delta})` : "";
    bullets.push(`- 전체 ${tf.count}명${d}`);
  } else {
    bullets.push(`- 전체 0명`);
  }
  return `${lead}${title}\n${bullets.join("\n")}\n<a href="${escapeHtml(opts.link)}">바로가기</a>`;
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
