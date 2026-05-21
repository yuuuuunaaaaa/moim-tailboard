import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { responseWhenTenantSlugMissing } from "@/lib/adminTenantSlug";
import { findTenantBySlug } from "@/lib/db";
import { parseOptionNamesJson } from "@/lib/optionItemSync";
import { execute, queryFirst } from "@/lib/queryRows";
import { canAccessTenant } from "@/lib/tenantRestrict";

// POST /api/admin/options — 옵션 그룹 추가
export async function POST(request: NextRequest) {
  try {
    const { admin, membership, username } = await getPageContext();
    if (!admin) return new Response("관리자만 접근할 수 있습니다.", { status: 403 });

    const formData = await request.formData();
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    if (!tenantSlug) return await responseWhenTenantSlugMissing(admin);
    const eventId = Number(formData.get("eventId"));
    const groupName = String(formData.get("groupName") ?? "").trim();
    const multipleSelect = formData.get("multipleSelect") === "true" ? 1 : 0;
    const optionNames = parseOptionNamesJson(String(formData.get("optionNames") ?? ""));

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!canAccessTenant(admin, tenant, membership)) {
      return new Response("소속 지역만 수정할 수 있습니다.", { status: 403 });
    }

    const event = await queryFirst<{ id: number }>(
      "SELECT id FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
      [eventId, tenant.id],
    );
    if (!event) return new Response("Event not found", { status: 404 });

    const groupResult = await execute(
      "INSERT INTO option_group (event_id, name, multiple_select) VALUES (?, ?, ?)",
      [event.id, groupName, multipleSelect],
    );
    const optionGroupId = groupResult.insertId;

    if (optionNames.length > 0) {
      const values = optionNames.map((name, idx) => [optionGroupId, name, idx]);
      await execute(
        "INSERT INTO option_item (option_group_id, name, sort_order) VALUES ?",
        [values],
      );
    }

    await execute(
      "INSERT INTO action_log (tenant_id, event_id, action, metadata) VALUES (?, ?, ?, JSON_OBJECT('username', ?, 'groupName', ?, 'optionNames', ?))",
      [
        tenant.id,
        event.id,
        "ADMIN_CREATE_OPTION_GROUP",
        username ?? null,
        groupName,
        JSON.stringify(optionNames),
      ],
    );

    return NextResponse.redirect(
      new URL(
        `/admin/events/${event.id}/edit?tenant=${encodeURIComponent(tenant.slug)}&toast=row_saved`,
        request.url,
      ),
      303,
    );
  } catch (err) {
    console.error("POST /api/admin/options:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
