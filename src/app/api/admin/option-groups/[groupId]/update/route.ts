import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { responseWhenTenantSlugMissing } from "@/lib/adminTenantSlug";
import { pool, findTenantBySlug } from "@/lib/db";
import type { Admin, Tenant } from "@/types";

function canAccessTenant(admin: Admin, tenant: Tenant): boolean {
  return admin.is_superadmin || admin.tenant_id === tenant.id;
}

// POST /api/admin/option-groups/[groupId]/update — 옵션 그룹/항목 수정
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const { admin, username } = await getPageContext();
    if (!admin) return new Response("관리자만 접근할 수 있습니다.", { status: 403 });

    const { groupId: groupIdStr } = await params;
    const groupId = Number(groupIdStr);

    const formData = await request.formData();
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    if (!tenantSlug) return await responseWhenTenantSlugMissing(admin);
    const eventId = Number(formData.get("eventId"));
    const groupName = String(formData.get("groupName") ?? "").trim();
    const multipleSelect = formData.get("multipleSelect") === "true" ? 1 : 0;
    const itemsText = String(formData.get("itemsText") ?? "");

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!canAccessTenant(admin, tenant)) return new Response("권한이 없습니다.", { status: 403 });

    // group이 실제로 해당 테넌트/꼬리달기 소속인지 확인
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [[row]] = await pool.query<any[]>(
      "SELECT og.id, og.event_id FROM option_group og JOIN event e ON og.event_id = e.id WHERE og.id = ? AND e.id = ? AND e.tenant_id = ? LIMIT 1",
      [groupId, eventId, tenant.id],
    );
    if (!row) return new Response("Option group not found", { status: 404 });

    await pool.query(
      "UPDATE option_group SET name = ?, multiple_select = ? WHERE id = ?",
      [groupName, multipleSelect, groupId],
    );

    const names = itemsText
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    // 기존 항목 전체 교체(삭제된 항목 선택은 FK로 함께 정리됨)
    await pool.query("DELETE FROM option_item WHERE option_group_id = ?", [groupId]);
    if (names.length > 0) {
      const values = names.map((n, idx) => [groupId, n, idx]);
      await pool.query(
        "INSERT INTO option_item (option_group_id, name, sort_order) VALUES ?",
        [values],
      );
    }

    await pool.query(
      "INSERT INTO action_log (tenant_id, event_id, action, metadata) VALUES (?, ?, ?, JSON_OBJECT('username', ?, 'groupId', ?, 'groupName', ?, 'multipleSelect', ?, 'itemNames', ?))",
      [
        tenant.id,
        eventId,
        "ADMIN_UPDATE_OPTION_GROUP",
        username ?? null,
        groupId,
        groupName,
        multipleSelect,
        JSON.stringify(names),
      ],
    );

    return NextResponse.redirect(new URL(`/admin/events/${eventId}?tenant=${tenant.slug}`, request.url), 303);
  } catch (err) {
    console.error("POST /api/admin/option-groups/[groupId]/update:", err);
    return new Response("Internal server error", { status: 500 });
  }
}

