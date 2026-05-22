import { cache } from "react";
import { unstable_cache } from "next/cache";
import { queryRows } from "@/lib/queryRows";
import { canManageTenantAccess } from "@/lib/tenantRestrict";
import type { Admin, Tenant } from "@/types";

function normalizeIsSuperadmin(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return value.length > 0 && value[0] === 1;
  }
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "1" || s === "true";
  }
  return false;
}

const TENANT_SELECT =
  "id, slug, name, chat_room_id, event_notice_chat_room_id, chat_room_thread_id, event_notice_chat_room_thread_id";

export type AdminMembership = {
  /** 표시·JWT 연동용 대표 admin 행 (superadmin 행 우선) */
  admin: Admin;
  managedTenants: Tenant[];
  managedTenantIds: number[];
  /** is_superadmin=1 인 admin 행이 연결된 지역 ID (지역당 최대 1명) */
  superadminTenantIds: number[];
};

type AdminRow = Admin & { is_superadmin: unknown };

async function loadAdminMembershipUncached(username: string): Promise<AdminMembership | null> {
  const u = username.trim();
  if (!u) return null;

  const rows = await queryRows<AdminRow>(
    `SELECT id, telegram_id, username, tenant_id, name, is_superadmin
     FROM admin WHERE username = ? ORDER BY is_superadmin DESC, id ASC`,
    [u],
  );
  if (rows.length === 0) return null;

  const primary: Admin = {
    ...rows[0]!,
    is_superadmin: normalizeIsSuperadmin(rows[0]!.is_superadmin),
  };

  const tenantIds = [...new Set(rows.map((r) => r.tenant_id))];
  const superadminTenantIds = [
    ...new Set(
      rows
        .filter((r) => normalizeIsSuperadmin(r.is_superadmin))
        .map((r) => r.tenant_id),
    ),
  ];

  if (tenantIds.length === 0) return null;

  const managedTenants = await queryRows<Tenant>(
    `SELECT ${TENANT_SELECT} FROM tenant WHERE id IN (?) ORDER BY name ASC`,
    [tenantIds],
  );

  return {
    admin: primary,
    managedTenants,
    managedTenantIds: managedTenants.map((t) => t.id),
    superadminTenantIds,
  };
}

const MEMBERSHIP_CACHE_TTL = (() => {
  const raw = process.env.ADMIN_CACHE_REVALIDATE_SECONDS;
  if (raw === undefined || raw === "") return 300;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 300;
})();

const loadAdminMembershipDataCached =
  MEMBERSHIP_CACHE_TTL === 0
    ? loadAdminMembershipUncached
    : unstable_cache(
        async (username: string) => loadAdminMembershipUncached(username),
        ["loadAdminMembership"],
        { revalidate: MEMBERSHIP_CACHE_TTL },
      );

export const loadAdminMembershipCached = cache(
  async (username: string): Promise<AdminMembership | null> => {
    const u = username.trim();
    if (!u) return null;
    return loadAdminMembershipDataCached(u);
  },
);

export function canManageTenant(
  membership: AdminMembership | null,
  tenantId: number,
): boolean {
  return canManageTenantAccess(membership, tenantId);
}

/** admin 테이블에 같은 username 으로 연결된 tenant 가 2개 이상 */
export function hasMultipleAdminTenants(membership: AdminMembership | null | undefined): boolean {
  return (membership?.managedTenants.length ?? 0) > 1;
}
