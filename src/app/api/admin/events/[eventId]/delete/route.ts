import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { responseWhenTenantSlugMissingForRequest } from "@/lib/adminTenantSlug";
import { findTenantBySlug, pool } from "@/lib/db";
import { boundTo } from "@/lib/queryRows";
import { canAccessTenant } from "@/lib/tenantRestrict";

// POST /api/admin/events/[eventId]/delete
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { admin, membership } = await getPageContext();
    if (!admin) return new Response("관리자만 접근할 수 있습니다.", { status: 403 });

    const { eventId: eventIdStr } = await params;
    const eventId = Number(eventIdStr);

    const formData = await request.formData();
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    if (!tenantSlug) return await responseWhenTenantSlugMissingForRequest();

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!canAccessTenant(admin, tenant, membership)) return new Response("권한이 없습니다.", { status: 403 });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const q = boundTo(conn);

      const evRow = await q.first<{ id: number; title: string }>(
        "SELECT id, title FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
        [eventId, tenant.id],
      );
      if (!evRow) {
        await conn.rollback();
        return new Response("꼬리달기를 찾을 수 없습니다.", { status: 404 });
      }

      await q.exec("DELETE FROM action_log WHERE tenant_id = ? AND event_id = ?", [
        tenant.id,
        eventId,
      ]);

      await q.exec("DELETE FROM event WHERE id = ? AND tenant_id = ?", [eventId, tenant.id]);

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    return NextResponse.redirect(new URL(`/admin?tenant=${tenant.slug}`, request.url), 303);
  } catch (err) {
    console.error("POST /api/admin/events/[eventId]/delete:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
