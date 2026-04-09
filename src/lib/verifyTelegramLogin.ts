import crypto from "crypto";

/**
 * Telegram Login Widget payload 검증.
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export async function verifyTelegramLogin(
  payload: Record<string, string | number | undefined>,
  botToken: string,
): Promise<boolean> {
  if (!payload || !botToken) return false;

  const { hash, ...rest } = payload;
  if (!hash || rest.id == null) return false;

  const checkString = Object.keys(rest)
    .sort()
    .filter((k) => rest[k] !== undefined && rest[k] !== "")
    .map((k) => `${k}=${rest[k]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

  return computedHash === hash;
}

/**
 * 검증된 Login Widget payload에서 텔레그램 식별자 추출.
 * username(사용자명) 우선, 없으면 숫자 id 사용.
 */
export function getTelegramUsernameFromPayload(
  payload: Record<string, string | number | undefined>,
): string | null {
  if (!payload || payload.id == null) return null;
  const username =
    payload.username != null && String(payload.username).trim() !== ""
      ? String(payload.username).trim()
      : null;
  return username || String(payload.id);
}
