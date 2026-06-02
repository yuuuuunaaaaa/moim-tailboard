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

/** ?tenant= 없을 때 이벤트 목록(또는 홈)으로 보냄 — 관리는 목록 헤더에서만 진입 */
export function redirectUnlessAdminTenantParam(
  slugParam: string,
  membership: AdminMembership,
  allowedSlug?: string,
): void {
  if (slugParam.trim()) return;

  const cookieSlug = allowedSlug?.trim();
  if (cookieSlug && membership.managedTenants.some((t) => t.slug === cookieSlug)) {
    redirect(`/t/${encodeURIComponent(cookieSlug)}/events`);
  }

  if (membership.managedTenants.length === 1) {
    redirect(`/t/${encodeURIComponent(membership.managedTenants[0]!.slug)}/events`);
  }

  redirect("/");
}

/** invalid slug 등 — 해당 지역 꼬리달기 목록으로 */
export function redirectAdminIfRedirect(res: AdminTenantResult): void {
  if (res.kind === "redirect") {
    redirect(`/t/${encodeURIComponent(res.canonicalSlug)}/events`);
  }
}

/** 소속 선택 UI 없음 — 홈(텔레그램 링크 안내)으로 */
export function redirectAdminIfChoose(res: AdminTenantResult): asserts res is Extract<
  AdminTenantResult,
  { kind: "ok" }
> {
  if (res.kind === "choose") redirect("/");
}
