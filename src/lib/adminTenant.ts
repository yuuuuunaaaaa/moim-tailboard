import { redirect } from "next/navigation";
import type { Tenant } from "@/types";
import type { AdminMembership } from "@/lib/adminMembership";

/**
 * 관리 페이지 지역 선택.
 * - username 에 연결된 admin 행의 테넌트 목록 (superadmin 포함, 지역에 귀속)
 */

type Choose = {
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

export type AdminTenantResult = Choose | Redirect | Missing | Ok;

export function resolveAdminTenant(
  membership: AdminMembership,
  slugParam: string,
): AdminTenantResult {
  const slug = slugParam.trim();
  const { managedTenants } = membership;

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

/** 엄격 모델: 소속 choose 는 `/admin` 에서만. missing·redirect 처리 후 호출. */
export function redirectAdminIfChoose(
  res: AdminTenantResult,
): asserts res is Extract<AdminTenantResult, { kind: "ok" }> {
  if (res.kind === "choose") redirect("/admin");
}
