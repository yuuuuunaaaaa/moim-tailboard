import { NextRequest, NextResponse } from "next/server";
import { findTenantBySlug } from "@/lib/db";
import { canManageTenant, loadAdminMembershipCached } from "@/lib/adminMembership";
import { verifyToken } from "@/lib/jwt-verify";
import { pickPostLoginPath } from "@/lib/loginReturnPath";
import { TENANT_COOKIE_NAME, TENANT_COOKIE_MAX_AGE } from "@/lib/tenantRestrict";

/**
 * 비로그인 또는 쿠키 미설정 시 allowed_tenant_slug 설정 후 리다이렉트.
 * 로그인한 일반 관리자는 관리 권한이 있는 지역 slug만 쿠키에 바인딩.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get("slug");
  const nextRaw = searchParams.get("next");

  if (!slug) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const tenant = await findTenantBySlug(slug);
  if (!tenant) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const token = request.cookies.get("auth_token")?.value;
  const authUser = token ? await verifyToken(token) : null;
  const membership = authUser
    ? await loadAdminMembershipCached(authUser.username)
    : null;

  if (membership && !canManageTenant(membership, tenant.id)) {
    const fallback = membership.managedTenants[0];
    if (fallback?.slug) {
      return NextResponse.redirect(
        new URL(`/t/${encodeURIComponent(fallback.slug)}/events`, request.url),
      );
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  const next = pickPostLoginPath(tenant.slug, nextRaw);
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
