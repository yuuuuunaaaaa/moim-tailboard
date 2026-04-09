import { NextRequest, NextResponse } from "next/server";

const UNAUTH_MESSAGE =
  '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>접근 불가</title></head><body style="font-family:sans-serif;text-align:center;padding:48px">' +
  "<h2>텔레그램 앱에서만 이용할 수 있습니다.</h2>" +
  "<p>이 서비스는 텔레그램 봇을 통해서만 접근할 수 있습니다.</p>" +
  "</body></html>";

/**
 * JWT payload를 암호화 검증 없이 디코드 (라우팅 결정용).
 * 실제 보안 검증은 각 Route Handler / Server Component에서 수행.
 * Edge 런타임(Vercel 미들웨어)에는 Node의 Buffer가 없으므로 atob 사용.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (base64.length % 4)) % 4;
    if (pad) base64 += "=".repeat(pad);
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const isLocalDev =
  process.env.NODE_ENV === "development" || process.env.ALLOW_LOCAL_WITHOUT_AUTH === "1";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 로컬 개발 환경에서는 인증 우회
  if (isLocalDev) return NextResponse.next();

  // 인증 없이 접근 가능한 경로
  const publicPaths = [
    "/login",
    "/api/auth/telegram-webapp",
    "/api/auth/telegram",
    "/api/health",
    "/api/init-tenant",
  ];
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth_token")?.value;
  const usernameCookie = request.cookies.get("username")?.value;

  // 비인증 접근 → /login 리다이렉트
  if (!token && !usernameCookie) {
    const tenantMatch = pathname.match(/^\/t\/([^/]+)/);
    const tenantSlug = tenantMatch ? tenantMatch[1] : "";
    const loginUrl = new URL("/login", request.url);
    if (tenantSlug) loginUrl.searchParams.set("tenantSlug", tenantSlug);
    return NextResponse.redirect(loginUrl);
  }

  // JWT 페이로드 디코드 (라우팅 결정용, 보안 검증 아님)
  const payload = token ? decodeJwtPayload(token) : null;
  const isAdmin = !!(payload?.is_admin);
  const isWebApp = !!(payload?.via_webapp);

  // 비관리자 + 비WebApp 접근 차단 (관리자 페이지 제외)
  if (!isAdmin && !isWebApp && !pathname.startsWith("/admin")) {
    return new NextResponse(UNAUTH_MESSAGE, {
      status: 403,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // /admin/* 경로는 admin JWT claim이 없으면 403
  if (pathname.startsWith("/admin") && !isAdmin) {
    return new NextResponse(
      '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>접근 불가</title></head>' +
        '<body style="font-family:sans-serif;text-align:center;padding:48px">' +
        "<h2>관리자만 접근할 수 있습니다.</h2></body></html>",
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|style.css).*)"],
};
