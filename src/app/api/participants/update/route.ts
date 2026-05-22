import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { loadAdminMembershipCached } from "@/lib/adminMembership";
import { findTenantBySlug } from "@/lib/db";
import { execute, queryFirst } from "@/lib/queryRows";
import { isTenantAccessGrantedForApi, TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";
import {
  fetchLeaveRemovedCountPerOptionGroup,
  fetchTenantParticipantSnapshots,
} from "@/lib/participantGroupCounts";
import {
  sendMessage,
  eventListUrl,
  buildParticipantTenantWideSummaryTelegramHtml,
  getChatRoomThreadId,
} from "@/lib/telegram";
import { isDevBypassEnabled } from "@/lib/dev";
import type { Participant } from "@/types";

type ParticipantWithEvent = Participant & { tenant_id: number; event_id: number };

// POST /api/participants/update — 수정 또는 취소 (JWT → username → DB)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    const participantId = Number(formData.get("participantId"));
    const mode = String(formData.get("mode") ?? "");
    const usernameFromForm = String(formData.get("username") ?? "").trim() || null;

    const auth = await getUserFromRequest(request);
    let username = auth?.username ?? null;
    if (!username && isDevBypassEnabled()) username = usernameFromForm;
    if (!username) return new Response("로그인이 필요합니다.", { status: 401 });

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });

    const allowedSlug = request.cookies.get(TENANT_COOKIE_NAME)?.value;
    const membership = await loadAdminMembershipCached(username);
    const admin = membership?.admin ?? null;
    if (!isTenantAccessGrantedForApi(admin, tenant, allowedSlug, membership)) {
      return new Response("접근이 거부되었습니다.", { status: 403 });
    }

    const participant = await queryFirst<ParticipantWithEvent>(
      "SELECT p.*, e.tenant_id, e.id AS event_id FROM participant p JOIN event e ON p.event_id = e.id WHERE p.id = ? LIMIT 1",
      [participantId],
    );
    if (!participant || participant.tenant_id !== tenant.id) {
      return new Response("Participant not found", { status: 404 });
    }
    const isOwner = participant.username === username;
    if (!isOwner) {
      return new Response("Not allowed to modify this participant", { status: 403 });
    }

    if (mode !== "delete") {
      return new Response("이름·옵션 수정은 update-one API를 사용하세요.", { status: 400 });
    }

    const removedByGroup = await fetchLeaveRemovedCountPerOptionGroup(participant.id);

    await execute(
      "INSERT INTO action_log (tenant_id, event_id, participant_id, action, metadata) VALUES (?, ?, ?, ?, JSON_OBJECT('name', ?))",
      [tenant.id, participant.event_id, participant.id, "CANCEL_EVENT", participant.name],
    );
    await execute("UPDATE action_log SET participant_id = NULL WHERE participant_id = ?", [
      participant.id,
    ]);
    await execute("DELETE FROM participant WHERE id = ?", [participant.id]);

    const ev = await queryFirst<{ telegram_participant_leave_prefix: string | null }>(
      "SELECT telegram_participant_leave_prefix FROM event WHERE id = ? LIMIT 1",
      [participant.event_id],
    );

    const snapshots = await fetchTenantParticipantSnapshots(
      tenant.id,
      participant.event_id,
      "leave",
      removedByGroup,
    );

    await sendMessage(
      tenant.chat_room_id,
      buildParticipantTenantWideSummaryTelegramHtml({
        events: snapshots,
        prefix: ev?.telegram_participant_leave_prefix ?? "",
      }),
      {
        webAppUrl: eventListUrl(tenant.slug),
        buttonText: "꼬리달기 목록",
        messageThreadId: getChatRoomThreadId(tenant),
      },
    );

    const toast = "cancelled";
    return NextResponse.redirect(
      new URL(`/t/${tenant.slug}/events/${participant.event_id}?toast=${toast}`, request.url),
      303,
    );
  } catch (err) {
    console.error("POST /api/participants/update:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
