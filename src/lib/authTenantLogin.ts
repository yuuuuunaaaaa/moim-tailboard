import { canManageTenant, loadAdminMembershipCached } from "@/lib/adminMembership";
import { findTenantBySlug } from "@/lib/db";

export const ERR_LOGIN_TENANT_REQUIRED =
  "소속이 포함된 링크로 접속해 주세요. (소속된 텔레그램에서 공유된 링크 또는 주소에 ?tenantSlug= 가 있어야 합니다.)";

/** 텔레그램 로그인: 관리자는 소속 링크 필요 (복수 소속이면 slug 로 구분) */
export async function assertLoginTenantContext(
  username: string,
  tenantSlug: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const membership = await loadAdminMembershipCached(username);

  if (!membership) {
    if (!tenantSlug) {
      return { ok: false, status: 403, error: ERR_LOGIN_TENANT_REQUIRED };
    }
    return { ok: true };
  }

  if (!tenantSlug) {
    if (membership.managedTenants.length === 1) {
      return { ok: true };
    }
    return { ok: false, status: 403, error: ERR_LOGIN_TENANT_REQUIRED };
  }

  const tenant = await findTenantBySlug(tenantSlug);
  if (!tenant) {
    return { ok: false, status: 404, error: "소속을 찾을 수 없습니다." };
  }

  if (!canManageTenant(membership, tenant.id)) {
    return { ok: false, status: 403, error: "관리 권한이 있는 소속 링크로만 로그인할 수 있습니다." };
  }

  return { ok: true };
}
