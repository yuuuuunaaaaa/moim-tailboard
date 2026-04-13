import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import type { Admin, Tenant } from "@/types";

const ERR_TELEGRAM =
  "지역(tenantSlug)이 없습니다. 소속 지역의 텔레그램에서 공유된 링크로 접속해 주세요.";

const ERR_SUPER_NEED_SLUG =
  "tenantSlug가 필요합니다. 관리 화면에서 지역을 선택한 뒤 다시 시도해 주세요.";

/**
 * 관리 API에서 tenantSlug 가 비어 있을 때.
 * - 일반 관리자: 텔레그램 링크 안내(403)
 * - 최고 관리자: 전체 테넌트 목록 포함(400 JSON)
 */
export async function responseWhenTenantSlugMissing(admin: Admin) {
  if (admin.is_superadmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [rows] = await pool.query<any[]>(
      "SELECT id, slug, name FROM tenant ORDER BY name ASC",
    );
    const tenants = rows as Tenant[];
    return NextResponse.json(
      {
        error: ERR_SUPER_NEED_SLUG,
        tenants: tenants.map((t) => ({ id: t.id, slug: t.slug, name: t.name })),
      },
      { status: 400 },
    );
  }
  return NextResponse.json({ error: ERR_TELEGRAM }, { status: 403 });
}
