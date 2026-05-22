import { NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import type { Admin, Tenant } from "@/types";

const ERR_TELEGRAM =
  "지역(tenantSlug)이 없습니다. 소속 지역의 텔레그램에서 공유된 링크로 접속해 주세요.";

const ERR_NEED_SLUG =
  "tenantSlug가 필요합니다. 관리 화면에서 지역을 선택한 뒤 다시 시도해 주세요.";

/**
 * 관리 API에서 tenantSlug 가 비어 있을 때.
 */
export async function responseWhenTenantSlugMissing(
  admin: Admin,
  managedTenants: Pick<Tenant, "id" | "slug" | "name">[],
) {
  if (managedTenants.length > 0) {
    return NextResponse.json(
      {
        error: ERR_NEED_SLUG,
        tenants: managedTenants.map((t) => ({ id: t.id, slug: t.slug, name: t.name })),
      },
      { status: 400 },
    );
  }
  return NextResponse.json({ error: ERR_TELEGRAM }, { status: 403 });
}

/** getPageContext 기반 — API 라우트에서 tenantSlug 누락 시 */
export async function responseWhenTenantSlugMissingForRequest() {
  const { admin, membership } = await getPageContext();
  if (!admin) {
    return NextResponse.json({ error: ERR_TELEGRAM }, { status: 403 });
  }
  return responseWhenTenantSlugMissing(admin, membership?.managedTenants ?? []);
}
