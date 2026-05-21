import type { Tenant } from "@/types";
import type { AdminMembership } from "@/lib/adminMembership";

/**
 * 관리 페이지의 중복 로직을 한 곳에 모은 헬퍼.
 * - superadmin: ?tenant= slug 파라미터를 강제, 없으면 "choose" 결과로 전체 테넌트 목록만 반환
 * - 일반 관리자: username 에 연결된 모든 admin 행의 테넌트 목록 사용 (복수 지역 지원)
 */

type SuperadminChoose = {
  kind: "choose";
  tenants: Tenant[];
};

type Redirect = {
  kind: "redirect";
  canonicalSlug: string;
};

type Missing = {
  kind: "missing";
  reason: "tenant_not_found" | "admin_tenant_not_found";
};

type Ok = {
  kind: "ok";
  tenant: Tenant;
  tenants: Tenant[];
};

export type AdminTenantResult = SuperadminChoose | Redirect | Missing | Ok;

/** 지역 조회 (membership 기준) */
export function resolveAdminTenant(
  membership: AdminMembership,
  slugParam: string,
): AdminTenantResult {
  const slug = slugParam.trim();
  const { admin, managedTenants } = membership;

  if (admin.is_superadmin) {
    if (!slug) return { kind: "choose", tenants: managedTenants };
    const found = managedTenants.find((t) => t.slug === slug);
    if (!found) return { kind: "missing", reason: "tenant_not_found" };
    return { kind: "ok", tenant: found, tenants: managedTenants };
  }

  if (managedTenants.length === 0) {
    return { kind: "missing", reason: "admin_tenant_not_found" };
  }

  if (!slug) {
    if (managedTenants.length === 1) {
      return { kind: "ok", tenant: managedTenants[0]!, tenants: managedTenants };
    }
    return { kind: "choose", tenants: managedTenants };
  }

  const found = managedTenants.find((t) => t.slug === slug);
  if (!found) {
    return { kind: "redirect", canonicalSlug: managedTenants[0]!.slug };
  }

  return { kind: "ok", tenant: found, tenants: managedTenants };
}

