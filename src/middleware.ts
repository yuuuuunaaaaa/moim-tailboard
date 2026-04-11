// Avoid `next/server`: it eagerly loads ua-parser-js (uses __dirname), which breaks Middleware on Edge (e.g. Vercel).
import { NextRequest } from "next/dist/server/web/spec-extension/request";
import { NextResponse } from "next/dist/server/web/spec-extension/response";

const UNAUTH_MESSAGE =
  '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>접근 불가</title></head><body style="font-family:sans-serif;text-align:center;padding:48px">' +
  "<h2>텔레그램 앱에서만 이용할 수 있습니다.</h2>" +
  "<p>이 서비스는 텔레그램 봇을 통해서만 접근할 수 있습니다.</p>" +
  "</body></html>";

/**
 * JWT payload를 암호화 검증 없이 디코드 (라우팅 결정용).
 * Edge 런타임: Buffer 미지원. UTF-8 클레임 대비해 TextDecoder 사용.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (base64.length % 4)) % 4;
    if (pad) base64 += "=".repeat(pad);

    if (typeof atob !== "function") return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i) & 0xff;
    }
    const json = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function redirectToLogin(request: NextRequest, tenantSlug: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (tenantSlug) url.searchParams.set("tenantSlug", tenantSlug);
  return NextResponse.redirect(url);
}

const isLocalDev =
  process.env.NODE_ENV === "development" || process.env.ALLOW_LOCAL_WITHOUT_AUTH === "1";

function runMiddleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (isLocalDev) return NextResponse.next();

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

  if (!token && !usernameCookie) {
    const tenantMatch = pathname.match(/^\/t\/([^/]+)/);
    const tenantSlug = tenantMatch ? tenantMatch[1] : "";
    return redirectToLogin(request, tenantSlug);
  }

  const payload = token ? decodeJwtPayload(token) : null;
  const isAdmin = !!(payload?.is_admin);
  const isWebApp = !!(payload?.via_webapp);

  if (!isAdmin && !isWebApp && !pathname.startsWith("/admin")) {
    return new NextResponse(UNAUTH_MESSAGE, {
      status: 403,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

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

export function middleware(request: NextRequest) {
  try {
    return runMiddleware(request);
  } catch (err) {
    console.error("[middleware] uncaught:", err);
    return redirectToLogin(request, "");
  }
}

export const config = {
  matcher: [
    // Run on pages + API, but never on Next internals (all of `/_next/*`) or common static assets.
    "/((?!_next/|favicon.ico|style.css|.*\\.(?:ico|svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
