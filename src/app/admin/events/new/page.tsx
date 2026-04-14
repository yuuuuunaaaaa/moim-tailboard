import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getPageContext } from "@/lib/auth";
import Header from "@/components/Header";
import AdminEventCreateForm from "@/components/AdminEventCreateForm";
import TenantSlugPersist from "@/components/TenantSlugPersist";
import type { Tenant } from "@/types";

interface Props {
  searchParams: Promise<{ tenant?: string }>;
}

export const metadata = { title: "이벤트 등록 · 꼬리달기" };

export default async function AdminEventNewPage({ searchParams }: Props) {
  const { admin, username, isAdmin, canChooseTenant } = await getPageContext();
  if (!admin) redirect("/login");

  const sp = await searchParams;
  const slugParam = (sp.tenant ?? "").trim();

  let tenant: Tenant;
  let tenants: Tenant[];

  if (admin.is_superadmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [rows] = await pool.query<any[]>("SELECT id, slug, name FROM tenant ORDER BY name ASC");
    tenants = rows as Tenant[];
    if (!slugParam) {
      return (
        <>
          <Header username={username} isAdmin={isAdmin} canChooseTenant={canChooseTenant} showAdminLink />
          <main className="container">
            <h1>이벤트 등록</h1>
            <p className="page-subtitle">최고 관리자는 지역을 먼저 선택해 주세요.</p>
            <ul className="event-list">
              {tenants.map((t) => (
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
    const found = tenants.find((t) => t.slug === slugParam);
    if (!found) {
      return <div style={{ padding: "48px", textAlign: "center" }}>지역을 찾을 수 없습니다.</div>;
    }
    tenant = found;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [[row]] = await pool.query<any[]>(
      "SELECT id, slug, name FROM tenant WHERE id = ? LIMIT 1",
      [admin.tenant_id],
    );
    if (!row) return <div style={{ padding: "48px", textAlign: "center" }}>소속 지역을 찾을 수 없습니다.</div>;
    tenant = row as Tenant;
    tenants = [tenant];
    if (slugParam && slugParam !== tenant.slug) {
      redirect(`/admin/events/new?tenant=${encodeURIComponent(tenant.slug)}`);
    }
  }

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
        <h1>이벤트 등록 — {tenant.name}</h1>
        <div className="card" style={{ marginTop: "12px" }}>
          <h2 className="card__title">이벤트 만들기</h2>
          <AdminEventCreateForm tenant={tenant} tenants={tenants} username={username} />
        </div>
      </main>
    </>
  );
}

