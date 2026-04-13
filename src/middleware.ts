// Avoid `next/server`: it eagerly loads ua-parser-js (uses __dirname), which breaks Middleware on Edge.
import { NextRequest } from "next/dist/server/web/spec-extension/request";
import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { verifyToken } from "@/lib/jwt-verify";

function tenantSlugFromPathname(pathname: string): string {
  const tPrefixed = pathname.match(/^\/t\/([^/]+)/);
  if (tPrefixed) return tPrefixed[1];
  const single = pathname.match(/^\/([^/]+)$/);
  if (!single) return "";
  const seg = single[1];
  if (seg === "login" || seg === "admin") return "";
  return seg;
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

async function runMiddleware(request: NextRequest): Promise<NextResponse> {
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
  const payload = token ? await verifyToken(token) : null;
  if (!payload?.username) {
    return redirectToLogin(request, tenantSlugFromPathname(pathname));
  }

  return NextResponse.next();
}

export async function middleware(request: NextRequest) {
  try {
    return await runMiddleware(request);
  } catch (err) {
    console.error("[middleware] uncaught:", err);
    return redirectToLogin(request, "");
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|style.css).*)"],
};
