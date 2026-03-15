const crypto = require("crypto");

/**
 * Verifies Telegram Login Widget payload (id, hash, auth_date, ...).
 * Used for desktop/browser login via the Telegram Login Widget.
 * See: https://core.telegram.org/widgets/login#checking-authorization
 *
 * @param {object} payload - Query/body with id, hash, auth_date and optional fields
 * @param {string} botToken - Bot token from BotFather
 * @returns {Promise<boolean>} - True if the payload is valid
 */
async function verifyTelegramLogin(payload, botToken) {
  if (!payload || !botToken) {
    return false;
  }

  const { hash, ...rest } = payload;
  if (!hash || rest.id == null) {
    return false;
  }

  const checkString = Object.keys(rest)
    .sort()
    .filter((k) => rest[k] !== undefined && rest[k] !== "")
    .map((k) => `${k}=${rest[k]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");

  return computedHash === hash;
}

/**
 * Extracts Telegram identifier from a verified Login Widget payload.
 * 한국에서 말하는 "텔레그램 ID" = username (사용자명). 없으면 숫자 id 사용.
 *
 * @param {object} payload - Verified payload with id, optional username
 * @returns {string | null} - username (우선) 또는 String(id), 없으면 null
 */
function getTelegramUsernameFromPayload(payload) {
  if (!payload || payload.id == null) return null;
  const username =
    payload.username != null && String(payload.username).trim() !== ""
      ? String(payload.username).trim()
      : null;
  return username || String(payload.id);
}

module.exports = {
  verifyTelegramLogin,
  getTelegramUsernameFromPayload,
};
