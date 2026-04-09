import type { Admin, Tenant } from "@/types";

export const TENANT_COOKIE_NAME = "allowed_tenant_slug";
export const TENANT_COOKIE_MAX_AGE = 90 * 24 * 60 * 60; // 90일 (초)

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
    if (admin.tenant_id === tenant.id) return "allowed";
    return "forbidden";
  }

  if (allowedSlug && allowedSlug !== tenant.slug) return "forbidden";
  if (!allowedSlug) return "init";
  return "allowed";
}
