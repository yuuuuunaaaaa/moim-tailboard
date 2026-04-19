import { queryFirst, queryRows } from "./queryRows";
import type { Admin, Tenant } from "@/types";

/**
 * 관리 페이지의 중복 로직을 한 곳에 모은 헬퍼.
 * - superadmin: ?tenant= slug 파라미터를 강제, 없으면 "choose" 결과로 전체 테넌트 목록만 반환
 * - 일반 관리자: 본인 tenant_id 기반 조회, URL slug가 다르면 redirect 슬러그 반환
 *
 * 페이지가 필요에 따라:
 * - result.kind === "choose" → 지역 선택 UI를 그림
 * - result.kind === "redirect" → `redirect(result.canonicalHref)` 호출
 * - result.kind === "missing" → "지역 없음" 빈 상태 렌더
 * - result.kind === "ok" → tenant/tenants로 본문 렌더
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

/** 지역 조회 (superadmin은 전체, 일반 관리자는 본인 것만) */
export async function resolveAdminTenant(
  admin: Admin,
  slugParam: string,
): Promise<AdminTenantResult> {
  const slug = slugParam.trim();

  if (admin.is_superadmin) {
    const tenants = await queryRows<Tenant>(
      "SELECT id, slug, name, chat_room_id FROM tenant ORDER BY name ASC",
    );
    if (!slug) return { kind: "choose", tenants };
    const found = tenants.find((t) => t.slug === slug);
    if (!found) return { kind: "missing", reason: "tenant_not_found" };
    return { kind: "ok", tenant: found, tenants };
  }

  const tenant = await queryFirst<Tenant>(
    "SELECT id, slug, name, chat_room_id FROM tenant WHERE id = ? LIMIT 1",
    [admin.tenant_id],
  );
  if (!tenant) return { kind: "missing", reason: "admin_tenant_not_found" };

  if (slug && slug !== tenant.slug) return { kind: "redirect", canonicalSlug: tenant.slug };

  return { kind: "ok", tenant, tenants: [tenant] };
}
