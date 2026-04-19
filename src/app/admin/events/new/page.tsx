import { redirect } from "next/navigation";
import { getPageContext } from "@/lib/auth";
import { resolveAdminTenant } from "@/lib/adminTenant";
import Header from "@/components/Header";
import AdminEventCreateForm from "@/components/AdminEventCreateForm";
import TenantSlugPersist from "@/components/TenantSlugPersist";

interface Props {
  searchParams: Promise<{ tenant?: string }>;
}

export const metadata = { title: "등록 · 꼬리달기" };

export default async function AdminEventNewPage({ searchParams }: Props) {
  const [{ admin, username, isAdmin, canChooseTenant }, sp] = await Promise.all([
    getPageContext(),
    searchParams,
  ]);
  if (!admin) redirect("/login");

  const slugParam = (sp.tenant ?? "").trim();
  const res = await resolveAdminTenant(admin, slugParam);

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
  if (res.kind === "choose") {
    return (
      <>
        <Header username={username} isAdmin={isAdmin} canChooseTenant={canChooseTenant} showAdminLink />
        <main className="container">
          <h1>꼬리달기 등록</h1>
          <p className="page-subtitle">최고 관리자는 지역을 먼저 선택해 주세요.</p>
          <ul className="event-list">
            {res.tenants.map((t) => (
              <li key={t.id} className="event-item">
                <a href={`/admin/events/new?tenant=${encodeURIComponent(t.slug)}`}>{t.name}</a>
                <div className="event-meta">{t.slug}</div>
              </li>
            ))}
          </ul>
          <p style={{ marginTop: "24px" }}>
            <a href="/admin" className="back-link">← 관리</a>
          </p>
        </main>
      </>
    );
  }

  const { tenant, tenants } = res;

  return (
    <>
      <TenantSlugPersist slug={tenant.slug} />
      <Header
        username={username}
        isAdmin={isAdmin}
        canChooseTenant={canChooseTenant}
        tenantSlug={tenant.slug}
        showAdminLink
      />
      <main className="container container--wide">
        <a href={`/admin?tenant=${encodeURIComponent(tenant.slug)}`} className="back-link">← 관리</a>
        <h1>꼬리달기 등록</h1>
        <div className="card" style={{ marginTop: "12px" }}>
          <h2 className="card__title">꼬리달기 만들기</h2>
          <AdminEventCreateForm tenant={tenant} tenants={tenants} username={username} />
        </div>
      </main>
    </>
  );
}
