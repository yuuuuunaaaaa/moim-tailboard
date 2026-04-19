import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { responseWhenTenantSlugMissing } from "@/lib/adminTenantSlug";
import { findTenantBySlug } from "@/lib/db";
import { execute, queryFirst } from "@/lib/queryRows";
import { canAccessTenant } from "@/lib/tenantRestrict";
import { toDateInputValue } from "@/lib/dateOnly";

// POST /api/admin/events/[eventId]/update
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { admin } = await getPageContext();
    if (!admin) return new Response("관리자만 접근할 수 있습니다.", { status: 403 });

    const { eventId: eventIdStr } = await params;
    const eventId = Number(eventIdStr);

    const formData = await request.formData();
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    if (!tenantSlug) return await responseWhenTenantSlugMissing(admin);
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    const eventDate = String(formData.get("eventDate") ?? "");
    const eventJoinPrefix = String(formData.get("eventTelegramJoinPrefix") ?? "").trim().slice(0, 64) || null;
    const eventLeavePrefix = String(formData.get("eventTelegramLeavePrefix") ?? "").trim().slice(0, 64) || null;

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!canAccessTenant(admin, tenant)) return new Response("권한이 없습니다.", { status: 403 });

    const dateOnly = toDateInputValue(eventDate);
    if (!dateOnly) return new Response("날짜 형식이 올바르지 않습니다.", { status: 400 });

    await execute(
      "UPDATE event SET title = ?, description = ?, event_date = ?, telegram_participant_join_prefix = ?, telegram_participant_leave_prefix = ? WHERE id = ? AND tenant_id = ?",
      [title, description, dateOnly, eventJoinPrefix, eventLeavePrefix, eventId, tenant.id],
    );

    // 수정 폼에서 새 옵션 그룹 추가
    const groupNames = formData.getAll("groupName").map(String).filter(Boolean);
    const multipleSelects = formData.getAll("multipleSelect").map(String);
    const optionTexts = formData.getAll("optionText").map(String);

    if (groupNames.length > 0) {
      // 기준 sort_order 한 번만 조회
      const existCount = await queryFirst<{ cnt: number }>(
        "SELECT COUNT(*) AS cnt FROM option_group WHERE event_id = ?",
        [eventId],
      );
      let sortOrder = Number(existCount?.cnt ?? 0);

      for (let i = 0; i < groupNames.length; i++) {
        const gName = groupNames[i].trim();
        if (!gName) continue;
        const gResult = await execute(
          "INSERT INTO option_group (event_id, name, multiple_select, sort_order) VALUES (?, ?, ?, ?)",
          [eventId, gName, multipleSelects[i] === "true" ? 1 : 0, sortOrder++],
        );
        const optNames = (optionTexts[i] || "").split("\n").map((s) => s.trim()).filter(Boolean);
        if (optNames.length > 0) {
          await execute(
            "INSERT INTO option_item (option_group_id, name, sort_order) VALUES ?",
            [optNames.map((n, idx) => [gResult.insertId, n, idx])],
          );
        }
      }
    }

    return NextResponse.redirect(
      new URL(`/admin?tenant=${tenant.slug}`, request.url),
      303,
    );
  } catch (err) {
    console.error("POST /api/admin/events/[eventId]/update:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
