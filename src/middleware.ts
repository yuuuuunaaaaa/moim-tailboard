// Avoid `next/server`: it eagerly loads ua-parser-js (uses __dirname), which breaks Middleware on Edge.
import { NextRequest } from "next/dist/server/web/spec-extension/request";
import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { verifyToken } from "@/lib/jwt-verify";
import { getDevDefaultTenantSlug, isDevBypassEnabled } from "@/lib/dev";
import { TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";

function redirectToLogin(request: NextRequest, tenantSlug: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (tenantSlug) url.searchParams.set("tenantSlug", tenantSlug);
  return NextResponse.redirect(url);
}

const isLocalDev = isDevBypassEnabled();

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    if (isLocalDev) {
      // dev: 기본 테넌트가 있으면 루트 접근 시 바로 이동
      const defaultTenant = getDevDefaultTenantSlug();
      const stay = request.nextUrl.searchParams.get("stay") === "1";
      if (pathname === "/" && defaultTenant && !stay) {
        return NextResponse.redirect(new URL(`/t/${encodeURIComponent(defaultTenant)}/events`, request.url));
      }
      // dev: 테넌트 페이지에서 allowed_tenant_slug 쿠키가 없으면 자동 init
      if (defaultTenant && pathname.startsWith("/t/") && !request.cookies.get(TENANT_COOKIE_NAME)?.value) {
        const next = encodeURIComponent(pathname + request.nextUrl.search);
        return NextResponse.redirect(
          new URL(`/api/init-tenant?slug=${encodeURIComponent(defaultTenant)}&next=${next}`, request.url),
        );
      }
      return NextResponse.next();
    }

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
    const payload = token ? await verifyToken(token) : null;

    if (!payload?.username) {
      const tenantMatch = pathname.match(/^\/t\/([^/]+)/);
      const tenantSlug = tenantMatch ? tenantMatch[1] : "";
      return redirectToLogin(request, tenantSlug);
    }

    // prod: 테넌트 페이지는 allowed_tenant_slug 쿠키가 있어야 API(참가/취소)가 403이 나지 않음.
    // 로그인 직후 이벤트 상세로 바로 진입하는 경우(텔레그램 WebApp 인증 후 reload 등) init-tenant를
    // 거치지 않아 쿠키가 비어있는 상태가 생길 수 있어 여기서 자동 초기화한다.
    const tenantMatch = pathname.match(/^\/t\/([^/]+)/);
    if (tenantMatch) {
      const tenantSlug = tenantMatch[1];
      const allowed = request.cookies.get(TENANT_COOKIE_NAME)?.value;
      if (!allowed || allowed !== tenantSlug) {
        const next = encodeURIComponent(pathname + request.nextUrl.search);
        return NextResponse.redirect(
          new URL(
            `/api/init-tenant?slug=${encodeURIComponent(tenantSlug)}&next=${next}`,
            request.url,
          ),
        );
      }
    }

    return NextResponse.next();
  } catch (err) {
    console.error("[middleware] uncaught:", err);
    return redirectToLogin(request, "");
  }
}

export const config = {
  matcher: [
    "/((?!api|_next/|favicon.ico|style.css|.*\\.(?:ico|svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
