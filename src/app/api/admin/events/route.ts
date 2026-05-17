import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { responseWhenTenantSlugMissing } from "@/lib/adminTenantSlug";
import { findTenantBySlug } from "@/lib/db";
import { execute, queryFirst } from "@/lib/queryRows";
import { canAccessTenant } from "@/lib/tenantRestrict";
import { sendMessage, eventDetailUrl, buildNewEventTelegramHtml } from "@/lib/telegram";
import { toDateInputValue } from "@/lib/dateOnly";

// POST /api/admin/events — 꼬리달기 생성
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
    const eventJoinPrefix = String(formData.get("eventTelegramJoinPrefix") ?? "").trim().slice(0, 64) || null;
    const eventLeavePrefix = String(formData.get("eventTelegramLeavePrefix") ?? "").trim().slice(0, 64) || null;

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!canAccessTenant(admin, tenant)) {
      return new Response("소속 지역만 등록할 수 있습니다.", { status: 403 });
    }

    const dateOnly = toDateInputValue(eventDate);
    if (!dateOnly) return new Response("날짜 형식이 올바르지 않습니다.", { status: 400 });

    // 새 이벤트는 같은 테넌트 내 최대 event_order + 1 로 두어 목록의 맨 뒤에 위치시킨다.
    // 관리자는 이후 드래그앤드롭(POST /api/admin/events/reorder)으로 위치를 옮길 수 있다.
    // INSERT VALUES 안에 같은 테이블 서브쿼리를 두면 MySQL 버전/락 모드에 따라 거절될 수 있어
    // 안전하게 두 단계로 분리한다.
    const maxRow = await queryFirst<{ next_order: number }>(
      "SELECT COALESCE(MAX(event_order), 0) + 1 AS next_order FROM event WHERE tenant_id = ?",
      [tenant.id],
    );
    const nextOrder = maxRow?.next_order ?? 1;

    const insertResult = await execute(
      `INSERT INTO event
         (tenant_id, title, description, event_date, is_active, event_order, telegram_participant_join_prefix, telegram_participant_leave_prefix)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant.id, title, description, dateOnly, isActive, nextOrder, eventJoinPrefix, eventLeavePrefix],
    );
    const eventId = insertResult.insertId;

    const groupNames = formData.getAll("groupName").map(String).filter(Boolean);
    const multipleSelects = formData.getAll("multipleSelect").map(String);
    const optionTexts = formData.getAll("optionText").map(String);

    for (let i = 0; i < groupNames.length; i++) {
      const gName = groupNames[i].trim();
      if (!gName) continue;
      const isMulti = multipleSelects[i] === "true" ? 1 : 0;
      const gResult = await execute(
        "INSERT INTO option_group (event_id, name, multiple_select, sort_order) VALUES (?, ?, ?, ?)",
        [eventId, gName, isMulti, i],
      );
      const optNames = (optionTexts[i] || "").split("\n").map((s) => s.trim()).filter(Boolean);
      if (optNames.length > 0) {
        await execute(
          "INSERT INTO option_item (option_group_id, name, sort_order) VALUES ?",
          [optNames.map((n, idx) => [gResult.insertId, n, idx])],
        );
      }
    }

    await execute(
      "INSERT INTO action_log (tenant_id, event_id, action, metadata) VALUES (?, ?, ?, JSON_OBJECT('username', ?, 'title', ?))",
      [tenant.id, eventId, "ADMIN_CREATE_EVENT", username ?? null, title],
    );

    // 꼬리달기 생성 알림은 tenant.event_notice_chat_room_id 로 분리 전송.
    // 값이 비어 있으면 기존 chat_room_id 로 폴백한다(마이그레이션 공백 대비).
    const eventNoticeChatRoomId =
      (tenant.event_notice_chat_room_id ?? "").trim() || tenant.chat_room_id;

    await sendMessage(
      eventNoticeChatRoomId,
      buildNewEventTelegramHtml({
        title,
        notifyIcon: telegramNotifyIcon,
        notifyHeadline: telegramNotifyHeadline,
        notifyExtra: telegramNotifyExtra,
      }),
      { webAppUrl: eventDetailUrl(tenant.slug, eventId), buttonText: "바로가기" },
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
