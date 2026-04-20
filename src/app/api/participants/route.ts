import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, loadAdminByUsernameCached } from "@/lib/auth";
import { findTenantBySlug } from "@/lib/db";
import { execute, queryFirst } from "@/lib/queryRows";
import { isTenantAccessGrantedForApi, TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";
import {
  fetchParticipantCountsPerOptionGroup,
  fetchJoinDeltaPerOptionGroup,
} from "@/lib/participantGroupCounts";
import { sendMessage, eventDetailUrl, buildParticipantOptionSummaryTelegramHtml } from "@/lib/telegram";
import { isDevBypassEnabled } from "@/lib/dev";
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

    const link = eventDetailUrl(tenant.slug, event.id);
    const [groupRows, joinDelta, countRow] = await Promise.all([
      fetchParticipantCountsPerOptionGroup(event.id),
      fetchJoinDeltaPerOptionGroup(optionItemIds),
      queryFirst<{ cnt: number }>(
        "SELECT COUNT(*) AS cnt FROM participant WHERE event_id = ?",
        [event.id],
      ),
    ]);

    const lines =
      groupRows.length > 0
        ? groupRows.map((g) => {
            const d = joinDelta.get(g.id);
            return {
              groupName: g.name,
              count: g.cnt,
              delta: d != null && d !== 0 ? d : undefined,
            };
          })
        : [];

    await sendMessage(
      tenant.chat_room_id,
      buildParticipantOptionSummaryTelegramHtml({
        link,
        lines,
        totalFallback:
          groupRows.length === 0
            ? { count: countRow?.cnt ?? 0, delta: 1 }
            : undefined,
        prefix: event.telegram_participant_join_prefix ?? "",
      }),
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
