import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { responseWhenTenantSlugMissing } from "@/lib/adminTenantSlug";
import { findTenantBySlug } from "@/lib/db";
import { execute, queryFirst, queryRows } from "@/lib/queryRows";
import { canAccessTenant } from "@/lib/tenantRestrict";

// POST /api/admin/events/[eventId]/participants/batch-update — 참여자 옵션 배치 수정
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { admin, username } = await getPageContext();
    if (!admin) return new Response("관리자만 접근할 수 있습니다.", { status: 403 });

    const { eventId: eventIdStr } = await params;
    const eventId = Number(eventIdStr);

    const formData = await request.formData();
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    if (!tenantSlug) return await responseWhenTenantSlugMissing(admin);

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!canAccessTenant(admin, tenant)) return new Response("권한이 없습니다.", { status: 403 });

    // 꼬리달기 소유 확인 + 그룹·참여자 목록 병렬 조회
    const [ev, groups, participants] = await Promise.all([
      queryFirst<{ id: number }>(
        "SELECT id FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
        [eventId, tenant.id],
      ),
      queryRows<{ id: number; multiple_select: number }>(
        "SELECT id, multiple_select FROM option_group WHERE event_id = ?",
        [eventId],
      ),
      queryRows<{ id: number }>(
        "SELECT id FROM participant WHERE event_id = ?",
        [eventId],
      ),
    ]);

    if (!ev) return new Response("Event not found", { status: 404 });

    const groupIds = groups.map((g) => g.id);
    const participantIds = participants.map((r) => r.id);

    if (participantIds.length === 0 || groupIds.length === 0) {
      return NextResponse.redirect(
        new URL(`/admin/events/${eventId}?tenant=${tenant.slug}`, request.url),
        303,
      );
    }

    await execute(
      "DELETE FROM participant_option WHERE participant_id IN (?)",
      [participantIds],
    );

    const values: Array<[number, number]> = [];
    participantIds.forEach((pid) => {
      groups.forEach((g) => {
        const key = `p_${pid}_g_${g.id}`;
        const rawVals = formData.getAll(key).map(String).filter(Boolean);
        rawVals.forEach((v) => {
          const optId = Number(v);
          if (!Number.isFinite(optId) || optId <= 0) return;
          values.push([pid, optId]);
        });
      });
    });

    if (values.length > 0) {
      await execute(
        "INSERT INTO participant_option (participant_id, option_item_id) VALUES ?",
        [values],
      );
    }

    await execute(
      "INSERT INTO action_log (tenant_id, event_id, action, metadata) VALUES (?, ?, ?, JSON_OBJECT('username', ?, 'participants', ?, 'mappings', ?))",
      [
        tenant.id,
        eventId,
        "ADMIN_BATCH_UPDATE_PARTICIPANT_OPTIONS",
        username ?? null,
        JSON.stringify(participantIds),
        values.length,
      ],
    );

    return NextResponse.redirect(
      new URL(`/admin/events/${eventId}?tenant=${tenant.slug}`, request.url),
      303,
    );
  } catch (err) {
    console.error("POST /api/admin/events/[eventId]/participants/batch-update:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
