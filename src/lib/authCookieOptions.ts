import { COOKIE_MAX_AGE } from "./jwt";

/**
 * `SameSite=Lax`(기본)는 대부분의 직접 접속에 충분함.
 * 일부 인앱 브라우저(삼성 인터넷·텔레그램 WebView 등)에서 탐색 시 세션 쿠키가 안 실리면
 * Vercel 환경 변수 `AUTH_COOKIE_SAME_SITE=none` 으로 시험(프로덕션에서는 `Secure`와 함께 동작).
 */
function authCookieSameSite(): "lax" | "none" | "strict" {
  const raw = process.env.AUTH_COOKIE_SAME_SITE?.trim().toLowerCase();
  if (raw === "none" || raw === "strict" || raw === "lax") return raw;
  return "lax";
}

export function getAuthTokenCookieOptions() {
  const sameSite = authCookieSameSite();
  const isProd = process.env.NODE_ENV === "production";
  /** SameSite=None 은 스펙상 Secure 필수 */
  const secure = isProd || sameSite === "none";
  return {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
  } as const;
}
