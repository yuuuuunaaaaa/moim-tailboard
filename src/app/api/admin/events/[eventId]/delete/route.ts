import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { responseWhenTenantSlugMissing } from "@/lib/adminTenantSlug";
import { pool, findTenantBySlug } from "@/lib/db";
import type { Admin, Tenant } from "@/types";

function canAccessTenant(admin: Admin, tenant: Tenant): boolean {
  return admin.is_superadmin || admin.tenant_id === tenant.id;
}

// POST /api/admin/events/[eventId]/delete
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

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [[evRow]] = await conn.query<any[]>(
        "SELECT id, title FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
        [eventId, tenant.id],
      );
      if (!evRow) {
        await conn.rollback();
        return new Response("꼬리달기를 찾을 수 없습니다.", { status: 404 });
      }

      await conn.query("DELETE FROM event WHERE id = ? AND tenant_id = ?", [eventId, tenant.id]);

      // 꼬리달기 삭제 후 기록 — DB FK 가 ON DELETE SET NULL 이면 기존 로그의 event_id/participant_id 는 NULL 로 유지됨
      await conn.query(
        `INSERT INTO action_log (tenant_id, event_id, participant_id, action, metadata)
         VALUES (?, NULL, NULL, ?, JSON_OBJECT('deletedEventId', ?, 'title', ?, 'username', ?))`,
        [
          tenant.id,
          "ADMIN_DELETE_EVENT",
          eventId,
          evRow.title ?? "",
          username ?? admin.username ?? null,
        ],
      );

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    return NextResponse.redirect(
      new URL(`/admin?tenant=${tenant.slug}`, request.url),
      303,
    );
  } catch (err) {
    console.error("POST /api/admin/events/[eventId]/delete:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
