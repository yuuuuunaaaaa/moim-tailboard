import { NextRequest, NextResponse } from "next/server";
import { TENANT_COOKIE_NAME, TENANT_COOKIE_MAX_AGE } from "@/lib/tenantRestrict";

/**
 * 비관리자가 테넌트에 최초 접근 시 allowed_tenant_slug 쿠키를 설정하고 리다이렉트.
 * Server Component에서 쿠키 직접 설정이 불가하므로 이 Route Handler를 경유.
 */
export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get("slug");
  const next = searchParams.get("next") || "/";

  if (!slug) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(TENANT_COOKIE_NAME, slug, {
    maxAge: TENANT_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}
