import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { responseWhenTenantSlugMissing } from "@/lib/adminTenantSlug";
import { findTenantBySlug } from "@/lib/db";
import {
  parseOptionItemsFromFormData,
  syncOptionGroupItems,
  withTransaction,
} from "@/lib/optionItemSync";
import { execute, queryFirst } from "@/lib/queryRows";
import { canAccessTenant } from "@/lib/tenantRestrict";

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
    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!canAccessTenant(admin, tenant)) return new Response("권한이 없습니다.", { status: 403 });

    // group이 실제로 해당 테넌트/꼬리달기 소속인지 확인
    const row = await queryFirst<{ id: number; event_id: number }>(
      "SELECT og.id, og.event_id FROM option_group og JOIN event e ON og.event_id = e.id WHERE og.id = ? AND e.id = ? AND e.tenant_id = ? LIMIT 1",
      [groupId, eventId, tenant.id],
    );
    if (!row) return new Response("Option group not found", { status: 404 });

    const itemInputs = parseOptionItemsFromFormData(formData);

    const savedNames = await withTransaction(async (_conn, db) => {
      await db.exec("UPDATE option_group SET name = ?, multiple_select = ? WHERE id = ?", [
        groupName,
        multipleSelect,
        groupId,
      ]);
      return syncOptionGroupItems(groupId, itemInputs, db);
    });

    await execute(
      "INSERT INTO action_log (tenant_id, event_id, action, metadata) VALUES (?, ?, ?, JSON_OBJECT('username', ?, 'groupId', ?, 'groupName', ?, 'multipleSelect', ?, 'itemNames', ?))",
      [
        tenant.id,
        eventId,
        "ADMIN_UPDATE_OPTION_GROUP",
        username ?? null,
        groupId,
        groupName,
        multipleSelect,
        JSON.stringify(savedNames),
      ],
    );

    return NextResponse.redirect(
      new URL(
        `/admin/events/${eventId}/edit?tenant=${encodeURIComponent(tenant.slug)}&toast=row_saved`,
        request.url,
      ),
      303,
    );
  } catch (err) {
    console.error("POST /api/admin/option-groups/[groupId]/update:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
