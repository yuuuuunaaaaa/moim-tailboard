import { loadAdminByUsername } from "@/lib/auth";
import { findTenantBySlug } from "@/lib/db";

/** 비-superadmin 은 반드시 tenantSlug 가 있는 링크로만 로그인 허용 */
export const ERR_LOGIN_TENANT_REQUIRED =
  "지역이 포함된 링크로 접속해 주세요. (소속 지역 텔레그램에서 공유된 링크 또는 주소에 ?tenantSlug= 가 있어야 합니다.)";

/**
 * 텔레그램 로그인 직후: superadmin 만 tenant 없이 허용.
 * 일반 관리자·참여자는 tenantSlug 필수이며, 일반 관리자는 URL 지역이 DB 소속과 일치해야 함.
 */
export async function assertLoginTenantContext(
  username: string,
  tenantSlug: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const admin = await loadAdminByUsername(username);

  if (admin?.is_superadmin) {
    return { ok: true };
  }

  if (!tenantSlug) {
    return { ok: false, status: 403, error: ERR_LOGIN_TENANT_REQUIRED };
  }

  const tenant = await findTenantBySlug(tenantSlug);
  if (!tenant) {
    return { ok: false, status: 404, error: "지역을 찾을 수 없습니다." };
  }

  if (admin && admin.tenant_id !== tenant.id) {
    return { ok: false, status: 403, error: "소속 지역 링크로만 로그인할 수 있습니다." };
  }

  return { ok: true };
}
