import { NextRequest, NextResponse } from "next/server";
import { findTenantBySlug } from "@/lib/db";
import { queryFirst } from "@/lib/queryRows";
import { loadAdminByUsername } from "@/lib/auth";
import { verifyToken } from "@/lib/jwt-verify";
import { TENANT_COOKIE_NAME, TENANT_COOKIE_MAX_AGE } from "@/lib/tenantRestrict";

/**
 * 비로그인 또는 쿠키 미설정 시 allowed_tenant_slug 설정 후 리다이렉트.
 * 로그인한 일반 관리자는 소속 지역 slug만 쿠키에 바인딩(다른 지역으로는 설정 불가).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get("slug");
  const next = searchParams.get("next") || "/";

  if (!slug) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const tenant = await findTenantBySlug(slug);
  if (!tenant) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const token = request.cookies.get("auth_token")?.value;
  const authUser = token ? await verifyToken(token) : null;
  const admin = authUser ? await loadAdminByUsername(authUser.username) : null;

  if (admin && !admin.is_superadmin) {
    if (tenant.id !== admin.tenant_id) {
      const row = await queryFirst<{ slug: string }>(
        "SELECT slug FROM tenant WHERE id = ? LIMIT 1",
        [admin.tenant_id],
      );
      if (row?.slug) {
        return NextResponse.redirect(
          new URL(`/t/${encodeURIComponent(row.slug)}/events`, request.url),
        );
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(TENANT_COOKIE_NAME, tenant.slug, {
    maxAge: TENANT_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}
