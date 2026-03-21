/**
 * 텔레그램 채팅방에 메시지를 보냅니다.
 * chat_room_id가 '-1'이면 전송을 건너뜁니다.
 */

function getAppBaseUrl() {
  const raw = (process.env.APP_URL || "http://localhost:3000").trim();
  const withProto = /^https?:\/\//.test(raw) ? raw : "https://" + raw;
  return withProto.replace(/\/$/, "");
}

/** 이벤트 상세 페이지 전체 URL (테넌트 slug + event id) */
function eventDetailUrl(tenantSlug, eventId) {
  const base = getAppBaseUrl();
  return `${base}/t/${encodeURIComponent(tenantSlug)}/events/${Number(eventId)}`;
}

/** Telegram HTML 모드용 이스케이프 */
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId || String(chatId) === "-1") return;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      console.warn("[telegram] sendMessage failed:", body);
    }
  } catch (err) {
    console.warn("[telegram] sendMessage error:", err.message);
  }
}

module.exports = { sendMessage, getAppBaseUrl, eventDetailUrl, escapeHtml };
