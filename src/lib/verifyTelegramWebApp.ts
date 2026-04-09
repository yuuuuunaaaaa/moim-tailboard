import crypto from "crypto";

/**
 * Telegram WebApp initData 검증 (Telegram.WebApp.initData).
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export async function verifyTelegramWebApp(
  initDataString: string,
  botToken: string,
): Promise<boolean> {
  if (!initDataString || !botToken) return false;

  const params = new URLSearchParams(initDataString);
  const hash = params.get("hash");
  if (!hash) return false;

  const pairs: string[] = [];
  params.forEach((val, key) => {
    if (key !== "hash") pairs.push(`${key}=${val}`);
  });
  pairs.sort((a, b) => a.localeCompare(b));
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return computedHash === hash;
}

/**
 * 검증된 initData에서 user 객체 추출.
 */
export async function parseUserFromInitData(
  initDataString: string,
): Promise<{ id: number; first_name?: string; last_name?: string; username?: string } | null> {
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
