import type { AdminMembership } from "@/lib/adminMembership";

/** 해당 지역의 superadmin(최고 관리자)인지 */
export function isSuperadminForTenant(
  membership: Pick<AdminMembership, "superadminTenantIds"> | null | undefined,
  tenantId: number,
): boolean {
  return membership?.superadminTenantIds.includes(tenantId) ?? false;
}
