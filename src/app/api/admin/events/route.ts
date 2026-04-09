import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { pool, findTenantBySlug } from "@/lib/db";
import { sendMessage, eventDetailUrl, escapeHtml } from "@/lib/telegram";
import type { Admin, Tenant } from "@/types";

function canAccessTenant(admin: Admin, tenant: Tenant): boolean {
  return admin.is_superadmin || admin.tenant_id === tenant.id;
}

// POST /api/admin/events — 이벤트 생성
export async function POST(request: NextRequest) {
  try {
    const { admin, username } = await getPageContext();
    if (!admin) return new Response("관리자만 접근할 수 있습니다.", { status: 403 });

    const formData = await request.formData();
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    const eventDate = String(formData.get("eventDate") ?? "");
    const isActive = formData.get("isActive") !== "false" ? 1 : 0;

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!canAccessTenant(admin, tenant)) {
      return new Response("소속 지역만 등록할 수 있습니다.", { status: 403 });
    }

    const when = new Date(eventDate);
    if (Number.isNaN(when.getTime())) {
      return new Response("일시 형식이 올바르지 않습니다.", { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result] = await pool.query<any>(
      "INSERT INTO event (tenant_id, title, description, event_date, is_active) VALUES (?, ?, ?, ?, ?)",
      [tenant.id, title, description, when, isActive],
    );
    const eventId = result.insertId;

    // 옵션 그룹 일괄 처리
    const groupNames = formData.getAll("groupName").map(String).filter(Boolean);
    const multipleSelects = formData.getAll("multipleSelect").map(String);
    const optionTexts = formData.getAll("optionText").map(String);

    for (let i = 0; i < groupNames.length; i++) {
      const gName = groupNames[i].trim();
      if (!gName) continue;
      const isMulti = multipleSelects[i] === "true" ? 1 : 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [gResult] = await pool.query<any>(
        "INSERT INTO option_group (event_id, name, multiple_select, sort_order) VALUES (?, ?, ?, ?)",
        [eventId, gName, isMulti, i],
      );
      const optNames = (optionTexts[i] || "").split("\n").map((s) => s.trim()).filter(Boolean);
      if (optNames.length > 0) {
        await pool.query(
          "INSERT INTO option_item (option_group_id, name, sort_order) VALUES ?",
          [optNames.map((n, idx) => [gResult.insertId, n, idx])],
        );
      }
    }

    await pool.query(
      "INSERT INTO action_log (tenant_id, event_id, action, metadata) VALUES (?, ?, ?, JSON_OBJECT('username', ?, 'title', ?))",
      [tenant.id, eventId, "ADMIN_CREATE_EVENT", username ?? null, title],
    );

    const link = eventDetailUrl(tenant.slug, eventId);
    await sendMessage(
      tenant.chat_room_id,
      `📅 <b>새 이벤트가 생성되었습니다!</b>\n이벤트명: ${escapeHtml(title)}\n<a href="${escapeHtml(link)}">바로가기</a>`,
    );

    return NextResponse.redirect(
      new URL(`/t/${tenant.slug}/events/${eventId}`, request.url),
      303,
    );
  } catch (err) {
    console.error("POST /api/admin/events:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
