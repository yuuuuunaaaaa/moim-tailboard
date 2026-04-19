import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { responseWhenTenantSlugMissing } from "@/lib/adminTenantSlug";
import { findTenantBySlug } from "@/lib/db";
import { execute, queryFirst, queryRows } from "@/lib/queryRows";
import { canAccessTenant } from "@/lib/tenantRestrict";

// POST /api/admin/events/[eventId]/participants/update-one — 참여자 옵션 1행 저장
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

    const participantId = Number(formData.get("participantId"));
    if (!Number.isFinite(participantId) || participantId <= 0) {
      return new Response("Invalid participantId", { status: 400 });
    }

    // 꼬리달기/참여자 소유 + 옵션 그룹 병렬 조회
    const [ev, p, groups] = await Promise.all([
      queryFirst<{ id: number }>(
        "SELECT id FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
        [eventId, tenant.id],
      ),
      queryFirst<{ id: number }>(
        "SELECT id FROM participant WHERE id = ? AND event_id = ? LIMIT 1",
        [participantId, eventId],
      ),
      queryRows<{ id: number; multiple_select: number }>(
        "SELECT id, multiple_select FROM option_group WHERE event_id = ?",
        [eventId],
      ),
    ]);

    if (!ev) return new Response("Event not found", { status: 404 });
    if (!p) return new Response("Participant not found", { status: 404 });

    const groupIds = groups.map((g) => g.id);
    const itemRows = groupIds.length
      ? await queryRows<{ id: number; option_group_id: number }>(
          "SELECT id, option_group_id FROM option_item WHERE option_group_id IN (?)",
          [groupIds],
        )
      : [];
    const itemById = new Map<number, { id: number; option_group_id: number }>();
    itemRows.forEach((r) => itemById.set(r.id, r));

    await execute(
      "DELETE FROM participant_option WHERE participant_id = ?",
      [participantId],
    );

    const values: Array<[number, number]> = [];
    for (const g of groups) {
      const key = `g_${g.id}`;
      const rawVals = formData.getAll(key).map(String).filter(Boolean);
      for (const v of rawVals) {
        const optId = Number(v);
        if (!Number.isFinite(optId) || optId <= 0) continue;
        const item = itemById.get(optId);
        if (!item) continue;
        if (item.option_group_id !== g.id) continue;
        values.push([participantId, optId]);
      }
      // 단일 선택인 경우 중복 방지 — 마지막 선택만 유지
      if (!g.multiple_select && values.length > 0) {
        const last = values.filter((t) => itemById.get(t[1])?.option_group_id === g.id);
        if (last.length > 1) {
          const keep = last[last.length - 1]!;
          for (let i = values.length - 1; i >= 0; i--) {
            const opt = values[i]!;
            if (itemById.get(opt[1])?.option_group_id === g.id && opt[1] !== keep[1]) {
              values.splice(i, 1);
            }
          }
        }
      }
    }

    if (values.length > 0) {
      await execute(
        "INSERT INTO participant_option (participant_id, option_item_id) VALUES ?",
        [values],
      );
    }

    await execute(
      "INSERT INTO action_log (tenant_id, event_id, participant_id, action, metadata) VALUES (?, ?, ?, ?, JSON_OBJECT('username', ?, 'mappings', ?))",
      [
        tenant.id,
        eventId,
        participantId,
        "ADMIN_UPDATE_PARTICIPANT_OPTIONS",
        username ?? null,
        values.length,
      ],
    );

    return NextResponse.redirect(
      new URL(
        `/admin/events/${eventId}/edit?tenant=${encodeURIComponent(tenant.slug)}&toast=row_saved`,
        request.url,
      ),
      303,
    );
  } catch (err) {
    console.error("POST /api/admin/events/[eventId]/participants/update-one:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
