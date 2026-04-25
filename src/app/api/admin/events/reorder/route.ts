import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { findTenantBySlug } from "@/lib/db";
import { canAccessTenant } from "@/lib/tenantRestrict";
import { execute, queryRows } from "@/lib/queryRows";

interface ReorderRequest {
  tenantSlug?: unknown;
  orderedIds?: unknown;
}

/**
 * POST /api/admin/events/reorder
 * 본문(JSON): { tenantSlug: string, orderedIds: number[] }
 *
 * orderedIds 배열의 인덱스를 그대로 event_order 값으로 저장한다.
 * 한 번의 UPDATE ... CASE WHEN 으로 일괄 갱신해서 라운드트립을 줄인다.
 *
 * 보안:
 * - 관리자 세션 필수
 * - tenantSlug 기반 권한 확인 (canAccessTenant)
 * - DB 측 WHERE에 tenant_id 를 강제해, 다른 테넌트의 event id 가 섞여 들어와도
 *   해당 행은 갱신되지 않는다.
 */
export async function POST(request: NextRequest) {
  try {
    const { admin } = await getPageContext();
    if (!admin) return new Response("관리자만 접근할 수 있습니다.", { status: 403 });

    const body = (await request.json().catch(() => null)) as ReorderRequest | null;
    if (!body) return new Response("Invalid JSON", { status: 400 });

    const tenantSlug = typeof body.tenantSlug === "string" ? body.tenantSlug.trim() : "";
    if (!tenantSlug) return new Response("tenantSlug is required", { status: 400 });

    const orderedIds = Array.isArray(body.orderedIds)
      ? body.orderedIds
          .map((v) => Number(v))
          .filter((n) => Number.isInteger(n) && n > 0)
      : [];
    if (orderedIds.length === 0) return new Response("orderedIds is empty", { status: 400 });

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!canAccessTenant(admin, tenant)) {
      return new Response("권한이 없습니다.", { status: 403 });
    }

    // 입력으로 받은 id 목록이 모두 이 테넌트 소속인지 확인 (혼합 방지)
    const validRows = await queryRows<{ id: number }>(
      "SELECT id FROM event WHERE tenant_id = ? AND id IN (?)",
      [tenant.id, orderedIds],
    );
    const validIdSet = new Set(validRows.map((r) => r.id));
    const filtered = orderedIds.filter((id) => validIdSet.has(id));
    if (filtered.length === 0) return new Response("No valid ids", { status: 400 });

    // CASE WHEN 으로 일괄 갱신.
    const cases = filtered.map((_, idx) => `WHEN ? THEN ${idx}`).join(" ");
    const sql = `
      UPDATE event
      SET event_order = CASE id ${cases} END
      WHERE tenant_id = ? AND id IN (?)
    `;
    await execute(sql, [...filtered, tenant.id, filtered]);

    return NextResponse.json({ ok: true, updated: filtered.length });
  } catch (err) {
    console.error("POST /api/admin/events/reorder:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
