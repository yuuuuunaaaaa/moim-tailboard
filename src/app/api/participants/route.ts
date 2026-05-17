import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, loadAdminByUsernameCached } from "@/lib/auth";
import { findTenantBySlug } from "@/lib/db";
import { execute, queryFirst } from "@/lib/queryRows";
import { isTenantAccessGrantedForApi, TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";
import {
  fetchJoinDeltaPerOptionGroup,
  fetchTenantParticipantSnapshots,
} from "@/lib/participantGroupCounts";
import { sendMessage, eventListUrl, buildParticipantTenantWideSummaryTelegramHtml } from "@/lib/telegram";
import { isDevBypassEnabled } from "@/lib/dev";
import { findParticipantByNameAndStudentNo } from "@/lib/participantDuplicate";
import type { Event } from "@/types";

// POST /api/participants — 참여 신청 (JWT → username → DB)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    const eventId = Number(formData.get("eventId"));
    const name = String(formData.get("name") ?? "").trim();
    const studentNo = String(formData.get("studentNo") ?? "").trim() || null;
    const optionItemIds = formData.getAll("optionItemIds").map(Number).filter(Boolean);
    const usernameFromForm = String(formData.get("username") ?? "").trim() || null;

    const auth = await getUserFromRequest(request);
    let username = auth?.username ?? null;
    if (!username && isDevBypassEnabled()) username = usernameFromForm;
    if (!username) {
      return new Response("로그인이 필요합니다. 텔레그램에서 열어 주세요.", { status: 401 });
    }

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });

    const allowedSlug = request.cookies.get(TENANT_COOKIE_NAME)?.value;
    const admin = await loadAdminByUsernameCached(username);
    if (!isTenantAccessGrantedForApi(admin, tenant, allowedSlug)) {
      return new Response("접근이 거부되었습니다.", { status: 403 });
    }

    const event = await queryFirst<Event>(
      "SELECT * FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
      [eventId, tenant.id],
    );
    if (!event) return new Response("Event not found", { status: 404 });

    const allowDuplicate = String(formData.get("allowDuplicate") ?? "") === "1";
    if (!allowDuplicate) {
      const duplicate = await findParticipantByNameAndStudentNo(event.id, name, studentNo);
      if (duplicate) {
        return NextResponse.redirect(
          new URL(`/t/${tenant.slug}/events/${event.id}?toast=duplicate`, request.url),
          303,
        );
      }
    }

    const insertResult = await execute(
      "INSERT INTO participant (event_id, name, student_no, username) VALUES (?, ?, ?, ?)",
      [event.id, name, studentNo, username],
    );
    const participantId = insertResult.insertId;

    if (optionItemIds.length > 0) {
      const values = optionItemIds.map((id) => [participantId, id]);
      await execute(
        "INSERT INTO participant_option (participant_id, option_item_id) VALUES ?",
        [values],
      );
    }

    await execute(
      "INSERT INTO action_log (tenant_id, event_id, participant_id, action, metadata) VALUES (?, ?, ?, ?, JSON_OBJECT('name', ?, 'studentNo', ?, 'username', ?, 'optionItemIds', ?))",
      [
        tenant.id,
        event.id,
        participantId,
        "JOIN_EVENT",
        name,
        studentNo,
        username,
        JSON.stringify(optionItemIds),
      ],
    );

    const link = eventListUrl(tenant.slug);
    const joinDelta = await fetchJoinDeltaPerOptionGroup(optionItemIds);
    const snapshots = await fetchTenantParticipantSnapshots(
      tenant.id,
      event.id,
      "join",
      joinDelta,
    );

    await sendMessage(
      tenant.chat_room_id,
      buildParticipantTenantWideSummaryTelegramHtml({
        events: snapshots,
        prefix: event.telegram_participant_join_prefix ?? "",
      }),
      { webAppUrl: link, buttonText: "꼬리달기 목록" },
    );

    return NextResponse.redirect(
      new URL(`/t/${tenant.slug}/events/${event.id}?toast=joined`, request.url),
      303,
    );
  } catch (err) {
    console.error("POST /api/participants:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
