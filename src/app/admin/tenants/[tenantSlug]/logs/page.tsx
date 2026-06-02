import { redirect } from "next/navigation";
import { findTenantBySlug } from "@/lib/db";
import { queryRows } from "@/lib/queryRows";
import { getPageContext } from "@/lib/auth";
import { isSuperadminForTenant } from "@/lib/superadmin";
import { ACTION_LABEL } from "@/lib/actionLogLabels";
import { summarizeActionLogMetadata } from "@/lib/parseActionLogMetadata";
import Header from "@/components/Header";
import TenantSlugPersist from "@/components/TenantSlugPersist";
import { formatKstDateTime } from "@/lib/dateFormat";

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

type LogRow = {
  id: number;
  action: string;
  created_at: Date | string;
  metadata: unknown;
  event_title: string | null;
};

export const metadata = { title: "활동 로그 · 꼬리달기" };

export default async function AdminTenantLogsPage({ params }: Props) {
  const [{ membership, isAdmin }, { tenantSlug }] = await Promise.all([
    getPageContext(),
    params,
  ]);
  if (!membership) redirect("/login");

  const tenant = await findTenantBySlug(tenantSlug);
  if (!tenant) {
    return <div style={{ padding: "48px", textAlign: "center" }}>지역을 찾을 수 없습니다.</div>;
  }

  if (!isSuperadminForTenant(membership, tenant.id)) {
    return (
      <>
        <Header isAdmin={isAdmin} tenantSlug={tenant.slug} tenantName={tenant.name} showAdminLink />
        <main className="container">
          <h2>접근 권한 없음</h2>
          <p className="page-subtitle">활동 로그는 해당 지역 최고 관리자만 볼 수 있습니다.</p>
          <a href={`/admin?tenant=${encodeURIComponent(tenant.slug)}`} className="back-link">← 관리</a>
        </main>
      </>
    );
  }

  const logs = await queryRows<LogRow>(
    `SELECT al.id, al.action, al.created_at, al.metadata, e.title AS event_title
     FROM action_log al
     LEFT JOIN event e ON e.id = al.event_id
     WHERE al.tenant_id = ?
     ORDER BY al.created_at DESC, al.id DESC
     LIMIT 300`,
    [tenant.id],
  );

  return (
    <>
      <TenantSlugPersist slug={tenant.slug} />
      <Header isAdmin={isAdmin} tenantSlug={tenant.slug} tenantName={tenant.name} showAdminLink showEventListLink />
      <main className="container container--wide page-tenant-logs">
        <a href={`/admin?tenant=${encodeURIComponent(tenant.slug)}`} className="back-link">← 관리</a>
        <h1>활동 로그</h1>
        <p className="page-subtitle">{tenant.name} · 최근 {logs.length}건</p>

        {logs.length === 0 ? (
          <p className="empty-state">기록이 없습니다.</p>
        ) : (
          <div className="audit-log-wrap">
            <table className="table audit-log-table">
              <thead>
                <tr>
                  <th>시각</th>
                  <th>유형</th>
                  <th>꼬리달기</th>
                  <th>내용</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const meta = summarizeActionLogMetadata(l.metadata);
                  return (
                    <tr key={l.id}>
                      <td className="audit-log-table__time">{formatKstDateTime(l.created_at)}</td>
                      <td>{ACTION_LABEL[l.action] ?? l.action}</td>
                      <td>{l.event_title ?? "—"}</td>
                      <td className="audit-log-table__content">{meta || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
