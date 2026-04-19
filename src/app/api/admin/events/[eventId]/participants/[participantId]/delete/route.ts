import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { responseWhenTenantSlugMissing } from "@/lib/adminTenantSlug";
import { findTenantBySlug } from "@/lib/db";
import { execute, queryFirst } from "@/lib/queryRows";
import { canAccessTenant } from "@/lib/tenantRestrict";

/** 관리자가 참여자 삭제 — DB 정리만 하고 텔레그램 알림은 보내지 않음 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; participantId: string }> },
) {
  try {
    const { admin, username } = await getPageContext();
    if (!admin) return new Response("관리자만 접근할 수 있습니다.", { status: 403 });

    const { eventId: eventIdStr, participantId: participantIdStr } = await params;
    const eventId = Number(eventIdStr);
    const participantId = Number(participantIdStr);

    if (!Number.isFinite(eventId) || eventId <= 0) {
      return new Response("Invalid eventId", { status: 400 });
    }
    if (!Number.isFinite(participantId) || participantId <= 0) {
      return new Response("Invalid participantId", { status: 400 });
    }

    const formData = await request.formData();
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    if (!tenantSlug) return await responseWhenTenantSlugMissing(admin);

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!canAccessTenant(admin, tenant)) return new Response("권한이 없습니다.", { status: 403 });

    // event 소유 확인 + 참여자 존재 확인을 단일 JOIN 쿼리로
    const participant = await queryFirst<{
      id: number;
      name: string;
      username: string;
    }>(
      `SELECT p.id, p.name, p.username
       FROM participant p
       JOIN event e ON p.event_id = e.id
       WHERE p.id = ? AND p.event_id = ? AND e.tenant_id = ?
       LIMIT 1`,
      [participantId, eventId, tenant.id],
    );
    if (!participant) {
      return new Response("Participant not found", { status: 404 });
    }

    await execute(
      `INSERT INTO action_log (tenant_id, event_id, participant_id, action, metadata)
       VALUES (?, ?, ?, ?, JSON_OBJECT('name', ?, 'participantUsername', ?, 'deletedBy', ?))`,
      [
        tenant.id,
        eventId,
        participant.id,
        "ADMIN_DELETE_PARTICIPANT",
        participant.name,
        participant.username,
        username ?? null,
      ],
    );
    await execute("UPDATE action_log SET participant_id = NULL WHERE participant_id = ?", [
      participant.id,
    ]);
    await execute("DELETE FROM participant WHERE id = ?", [participant.id]);

    return NextResponse.redirect(
      new URL(
        `/admin/events/${eventId}/edit?tenant=${encodeURIComponent(tenant.slug)}&toast=participant_deleted`,
        request.url,
      ),
      303,
    );
  } catch (err) {
    console.error("POST /api/admin/events/[eventId]/participants/[participantId]/delete:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
