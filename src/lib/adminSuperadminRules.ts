import { queryFirst } from "@/lib/queryRows";

/** 지역에 이미 superadmin 이 있으면 에러 (excludeAdminId: 수정 시 자기 자신 제외) */
export async function tenantAlreadyHasSuperadmin(
  tenantId: number,
  excludeAdminId?: number,
): Promise<boolean> {
  const row = await queryFirst<{ id: number }>(
    excludeAdminId != null
      ? "SELECT id FROM admin WHERE tenant_id = ? AND is_superadmin = 1 AND id <> ? LIMIT 1"
      : "SELECT id FROM admin WHERE tenant_id = ? AND is_superadmin = 1 LIMIT 1",
    excludeAdminId != null ? [tenantId, excludeAdminId] : [tenantId],
  );
  return !!row;
}
