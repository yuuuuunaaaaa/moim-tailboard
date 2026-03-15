const crypto = require("crypto");

/**
 * Verifies Telegram WebApp initData (from Telegram.WebApp.initData).
 * See: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * @param {string} initDataString - Raw initData query string from the client
 * @param {string} botToken - Bot token from BotFather
 * @returns {Promise<boolean>} - True if the data is valid and from Telegram
 */
async function verifyTelegramWebApp(initDataString, botToken) {
  if (!initDataString || !botToken) {
    return false;
  }

  const params = new URLSearchParams(initDataString);
  const hash = params.get("hash");
  if (!hash) {
    return false;
  }

  const pairs = [];
  params.forEach((val, key) => {
    if (key !== "hash") {
      pairs.push(`${key}=${val}`);
    }
  });
  pairs.sort((a, b) => a.localeCompare(b));
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return computedHash === hash;
}

/**
 * Extracts the user object from validated initData.
 *
 * @param {string} initDataString - Raw initData query string
 * @returns {Promise<{ id: number, first_name?: string, last_name?: string, username?: string } | null>}
 */
async function parseUserFromInitData(initDataString) {
  if (!initDataString) return null;
  const params = new URLSearchParams(initDataString);
  const userJson = params.get("user");
  if (!userJson) return null;
  try {
    const user = JSON.parse(decodeURIComponent(userJson));
    return user && typeof user.id === "number" ? user : null;
  } catch {
    return null;
  }
}

module.exports = {
  verifyTelegramWebApp,
  parseUserFromInitData,
};
