import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { pool, findTenantBySlugCached } from "@/lib/db";
import { getPageContext } from "@/lib/auth";
import { checkTenantAccess, TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";
import Header from "@/components/Header";
import TenantSlugPersist from "@/components/TenantSlugPersist";
import type { Event } from "@/types";
import { toDateInputValue } from "@/lib/dateOnly";

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

export default async function EventListPage({ params }: Props) {
  const { tenantSlug } = await params;
  const tenant = await findTenantBySlugCached(tenantSlug);
  if (!tenant) return <div style={{ padding: "48px", textAlign: "center" }}>지역을 찾을 수 없습니다.</div>;

  const { admin, username, isAdmin, canChooseTenant } = await getPageContext();
  const cookieStore = await cookies();
  const allowedSlug = cookieStore.get(TENANT_COOKIE_NAME)?.value;
  const access = checkTenantAccess(admin, tenant, allowedSlug);

  if (access === "forbidden") {
    return (
      <div style={{ padding: "48px", textAlign: "center" }}>
        <h2>접근이 거부되었습니다.</h2>
        <p>{admin ? "소속 지역만 접근할 수 있습니다." : "다른 지역에는 접근할 수 없습니다."}</p>
      </div>
    );
  }

  if (access === "init") {
    const next = encodeURIComponent(`/t/${tenantSlug}/events`);
    redirect(`/api/init-tenant?slug=${encodeURIComponent(tenantSlug)}&next=${next}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows] = await pool.query<any[]>(
    "SELECT * FROM event WHERE tenant_id = ? AND is_active = 1 ORDER BY event_date ASC",
    [tenant.id],
  );
  const events = rows as Event[];

  return (
    <>
      <TenantSlugPersist slug={tenant.slug} />
      <Header
        username={username}
        isAdmin={isAdmin}
        canChooseTenant={canChooseTenant}
        tenantSlug={tenantSlug}
      />
      <main className="container">
        {canChooseTenant && <a href="/?stay=1" className="back-link">← 지역 선택</a>}
        <p className="page-subtitle">진행 중인 꼬리달기에 참여할 수 있습니다.</p>
        {events.length === 0 ? (
          <div className="empty-state">
            진행 중인 꼬리달기가 없습니다.
            {isAdmin && (
              <div style={{ marginTop: "16px" }}>
                <a href={`/admin?tenant=${tenant.slug}`} className="btn btn--primary">꼬리달기 만들기</a>
              </div>
            )}
          </div>
        ) : (
          <ul className="event-list">
            {events.map((event) => (
              <li key={event.id} className="event-item">
                <a href={`/t/${tenant.slug}/events/${event.id}`}>{event.title}</a>
                <div className="event-meta">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  {toDateInputValue(event.event_date)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
