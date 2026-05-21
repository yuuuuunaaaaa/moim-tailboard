import type { Admin, Tenant } from "@/types";

export const TENANT_COOKIE_NAME = "allowed_tenant_slug";
export const TENANT_COOKIE_MAX_AGE = 90 * 24 * 60 * 60; // 90일 (초)

/** DB 없이 권한만 검사 (클라이언트·서버 공용) */
export type AdminTenantAccess = {
  admin: Pick<Admin, "is_superadmin">;
  managedTenantIds: readonly number[];
};

export function canManageTenantAccess(
  membership: AdminTenantAccess | null | undefined,
  tenantId: number,
): boolean {
  if (!membership) return false;
  if (membership.admin.is_superadmin) return true;
  return membership.managedTenantIds.includes(tenantId);
}

function tenantIdsFrom(membership?: AdminTenantAccess | null): readonly number[] {
  return membership?.managedTenantIds ?? [];
}

/** 관리자(superadmin 포함)가 해당 테넌트에 접근 가능한지. API·관리 페이지 공용. */
export function canAccessTenant(
  admin: Admin,
  tenant: Tenant,
  membershipOrIds?: AdminTenantAccess | null | readonly number[],
): boolean {
  if (admin.is_superadmin) return true;
  if (membershipOrIds && typeof membershipOrIds === "object" && "managedTenantIds" in membershipOrIds) {
    return canManageTenantAccess(membershipOrIds as AdminTenantAccess, tenant.id);
  }
  const ids = Array.isArray(membershipOrIds) ? membershipOrIds : [];
  if (ids.length > 0) return ids.includes(tenant.id);
  return admin.tenant_id === tenant.id;
}

/**
 * 테넌트 접근 허용 여부 확인 (Next.js용).
 * - superadmin → 모든 테넌트 허용
 * - admin → membership 에 포함된 테넌트만 허용
 * - 비관리자 → 쿠키에 저장된 테넌트만 허용
 */
export function checkTenantAccess(
  admin: Admin | null,
  tenant: Tenant,
  allowedSlug: string | undefined,
  membership?: AdminTenantAccess | null,
): "allowed" | "forbidden" | "init" {
  if (admin) {
    if (admin.is_superadmin) return "allowed";
    const ids = tenantIdsFrom(membership);
    if (ids.includes(tenant.id)) {
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
 * 일반 관리자는 소속 테넌트면 쿠키 미동기 상태에서도 API는 허용(membership 이 최종 권한).
 */
export function isTenantAccessGrantedForApi(
  admin: Admin | null,
  tenant: Tenant,
  allowedSlug: string | undefined,
  membership?: AdminTenantAccess | null,
): boolean {
  const access = checkTenantAccess(admin, tenant, allowedSlug, membership);
  if (access === "allowed") return true;
  if (access === "forbidden") return false;
  if (admin?.is_superadmin) return true;
  return canManageTenantAccess(membership, tenant.id);
}
