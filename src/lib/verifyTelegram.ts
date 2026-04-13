import crypto from "node:crypto";

/** Login Widget: auth_date 허용 오차(초). Telegram 권장과 동일하게 24시간. */
export const TELEGRAM_AUTH_MAX_AGE_SEC = 86400;

/**
 * Telegram Login Widget 인증 데이터 검증 (HMAC-SHA256).
 * @see https://core.telegram.org/widgets/login#checking-authorization
 *
 * - bot token으로 secret key 생성 후 hash 비교
 * - auth_date가 현재 시각 기준 TELEGRAM_AUTH_MAX_AGE_SEC 이내인지 검증
 * - username(공개 사용자명)이 비어 있으면 실패 — 서비스는 username만 사용
 */
export function verifyTelegramLoginWidget(
  payload: Record<string, unknown>,
  botToken: string,
): boolean {
  if (!botToken || !payload || typeof payload !== "object") return false;

  const hash = payload.hash;
  if (typeof hash !== "string" || !hash) return false;

  const username =
    typeof payload.username === "string" && payload.username.trim() !== ""
      ? payload.username.trim()
      : null;
  if (!username) return false;

  const authDate = Number(payload.auth_date);
  if (!Number.isFinite(authDate)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - authDate) > TELEGRAM_AUTH_MAX_AGE_SEC) return false;

  const { hash: _drop, ...rest } = payload;
  const checkString = Object.keys(rest)
    .sort()
    .map((k) => {
      const v = rest[k as keyof typeof rest];
      return `${k}=${v == null ? "" : String(v)}`;
    })
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");
  return computed === hash;
}

/**
 * 위젯 payload에서 username만 추출 (검증 성공 후 호출).
 */
export function getLoginWidgetUsername(payload: Record<string, unknown>): string | null {
  if (typeof payload.username !== "string") return null;
  const u = payload.username.trim();
  return u || null;
}

// --- Web App (Mini App) initData ---

/**
 * Telegram WebApp initData 검증 (HMAC-SHA256).
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramWebAppInitData(initDataString: string, botToken: string): boolean {
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
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return computed === hash;
}

/**
 * initData의 user JSON에서 username만 추출. 없거나 비어 있으면 null (로그인 불가).
 * telegram id 기반 폴백 없음.
 */
export function getWebAppUsernameFromInitData(initDataString: string): string | null {
  if (!initDataString) return null;
  const params = new URLSearchParams(initDataString);
  const raw = params.get("user");
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as { username?: unknown };
    if (typeof user.username !== "string") return null;
    const u = user.username.trim();
    return u || null;
  } catch {
    return null;
  }
}
