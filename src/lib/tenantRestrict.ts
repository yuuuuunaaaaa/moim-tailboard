import type { Admin, Tenant } from "@/types";

export const TENANT_COOKIE_NAME = "allowed_tenant_slug";
export const TENANT_COOKIE_MAX_AGE = 90 * 24 * 60 * 60; // 90일 (초)

/** 관리자(superadmin 포함)가 해당 테넌트에 접근 가능한지. API·관리 페이지 공용. */
export function canAccessTenant(admin: Admin, tenant: Tenant): boolean {
  return admin.is_superadmin || admin.tenant_id === tenant.id;
}

/**
 * 테넌트 접근 허용 여부 확인 (Next.js용).
 * - superadmin → 모든 테넌트 허용
 * - admin(소속 테넌트만) → admin.tenant_id === tenant.id 일 때만 허용
 * - 비관리자 → 쿠키에 저장된 테넌트만 허용
 *
 * @returns "allowed" | "forbidden" | "init" (쿠키를 새로 설정해야 함)
 */
export function checkTenantAccess(
  admin: Admin | null,
  tenant: Tenant,
  allowedSlug: string | undefined,
): "allowed" | "forbidden" | "init" {
  if (admin) {
    if (admin.is_superadmin) return "allowed";
    if (admin.tenant_id === tenant.id) {
      // 비-superadmin: URL 테넌트는 DB 소속과 일치. 쿠키도 동일하게 맞춰 참여자·API와 완전히 분리.
      if (allowedSlug !== tenant.slug) return "init";
      return "allowed";
    }
    return "forbidden";
  }

  if (allowedSlug && allowedSlug !== tenant.slug) return "forbidden";
  if (!allowedSlug) return "init";
  return "allowed";
}

/**
 * Route Handler용. HTML은 `init`일 때 init-tenant로 보내고,
 * 일반 관리자는 소속 테넌트면 쿠키 미동기 상태에서도 API는 허용(DB tenant_id가 최종 권한).
 */
export function isTenantAccessGrantedForApi(
  admin: Admin | null,
  tenant: Tenant,
  allowedSlug: string | undefined,
): boolean {
  const access = checkTenantAccess(admin, tenant, allowedSlug);
  if (access === "allowed") return true;
  if (access === "forbidden") return false;
  return !!(admin && !admin.is_superadmin && admin.tenant_id === tenant.id);
}
