import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { responseWhenTenantSlugMissing } from "@/lib/adminTenantSlug";
import { pool, findTenantBySlug } from "@/lib/db";
import { sendMessage, eventDetailUrl, buildNewEventTelegramHtml } from "@/lib/telegram";
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
    if (!tenantSlug) return await responseWhenTenantSlugMissing(admin);
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    const eventDate = String(formData.get("eventDate") ?? "");
    const isActive = formData.get("isActive") !== "false" ? 1 : 0;
    const telegramNotifyIcon = String(formData.get("telegramNotifyIcon") ?? "").trim().slice(0, 32) || null;
    const telegramNotifyHeadline = String(formData.get("telegramNotifyHeadline") ?? "").trim().slice(0, 120) || null;
    const telegramNotifyExtra = String(formData.get("telegramNotifyExtra") ?? "").trim().slice(0, 500) || null;
    const eventJoinPrefix =
      String(formData.get("eventTelegramJoinPrefix") ?? "").trim().slice(0, 64) || null;
    const eventLeavePrefix =
      String(formData.get("eventTelegramLeavePrefix") ?? "").trim().slice(0, 64) || null;

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
      "INSERT INTO event (tenant_id, title, description, event_date, is_active, telegram_participant_join_prefix, telegram_participant_leave_prefix) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [tenant.id, title, description, when, isActive, eventJoinPrefix, eventLeavePrefix],
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
    const telegramBody = buildNewEventTelegramHtml({
      title,
      link,
      notifyIcon: telegramNotifyIcon,
      notifyHeadline: telegramNotifyHeadline,
      notifyExtra: telegramNotifyExtra,
    });
    await sendMessage(tenant.chat_room_id, telegramBody);

    return NextResponse.redirect(
      new URL(`/t/${tenant.slug}/events/${eventId}`, request.url),
      303,
    );
  } catch (err) {
    console.error("POST /api/admin/events:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
