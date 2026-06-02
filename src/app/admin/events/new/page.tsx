import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPageContext } from "@/lib/auth";
import {
  redirectAdminIfChoose,
  redirectUnlessAdminTenantParam,
  resolveAdminTenant,
} from "@/lib/adminTenant";
import { TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";
import Header from "@/components/Header";
import AdminEventCreateForm from "@/components/AdminEventCreateForm";
import TenantSlugPersist from "@/components/TenantSlugPersist";

interface Props {
  searchParams: Promise<{ tenant?: string }>;
}

export const metadata = { title: "등록 · 꼬리달기" };

export default async function AdminEventNewPage({ searchParams }: Props) {
  const [{ admin, membership, username, isAdmin }, sp, cookieStore] = await Promise.all([
    getPageContext(),
    searchParams,
    cookies(),
  ]);
  if (!admin || !membership) redirect("/login");

  const slugParam = (sp.tenant ?? "").trim();
  const allowedSlug = cookieStore.get(TENANT_COOKIE_NAME)?.value;
  redirectUnlessAdminTenantParam(slugParam, membership, allowedSlug);

  const res = resolveAdminTenant(membership, slugParam);

  if (res.kind === "missing") {
    return (
      <div style={{ padding: "48px", textAlign: "center" }}>
        {res.reason === "admin_tenant_not_found" ? "소속 지역을 찾을 수 없습니다." : "지역을 찾을 수 없습니다."}
      </div>
    );
  }
  if (res.kind === "redirect") {
    redirect(`/admin/events/new?tenant=${encodeURIComponent(res.canonicalSlug)}`);
  }
  redirectAdminIfChoose(res);

  const { tenant } = res;

  return (
    <>
      <TenantSlugPersist slug={tenant.slug} />
      <Header isAdmin={isAdmin} tenantSlug={tenant.slug} showAdminLink showEventListLink />
      <main className="container container--wide">
        <a href={`/admin?tenant=${encodeURIComponent(tenant.slug)}`} className="back-link">← 관리</a>
        <h1>꼬리달기 등록</h1>
        <div className="card" style={{ marginTop: "12px" }}>
          <h2 className="card__title">꼬리달기 만들기</h2>
          <AdminEventCreateForm tenant={tenant} username={username} />
        </div>
      </main>
    </>
  );
}
