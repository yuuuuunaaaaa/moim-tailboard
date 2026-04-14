import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getPageContext } from "@/lib/auth";
import Header from "@/components/Header";
import AdminEventEdit from "@/components/AdminEventEdit";
import TenantSlugPersist from "@/components/TenantSlugPersist";
import type { Event, OptionGroup, OptionItem, Tenant } from "@/types";

interface Props {
  searchParams: Promise<{ tenant?: string }>;
}

export const metadata = { title: "관리 · 꼬리달기" };

export default async function AdminPage({ searchParams }: Props) {
  const { admin, username, isAdmin, canChooseTenant } = await getPageContext();
  if (!admin) redirect("/login");

  const sp = await searchParams;
  const slugParam = (sp.tenant ?? "").trim();

  let tenant: Tenant;
  let tenants: Tenant[];

  if (admin.is_superadmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [rows] = await pool.query<any[]>(
      "SELECT id, slug, name FROM tenant ORDER BY name ASC",
    );
    tenants = rows as Tenant[];

    if (!slugParam) {
      if (tenants.length === 0) {
        return (
          <div style={{ padding: "48px", textAlign: "center" }}>등록된 지역이 없습니다.</div>
        );
      }
      return (
        <>
          <Header
            username={username}
            isAdmin={isAdmin}
            canChooseTenant={canChooseTenant}
            showAdminLink
          />
          <main className="container">
            <h1>관리 — 지역 선택</h1>
            <p className="page-subtitle">관리할 지역을 선택하세요. (최고 관리자)</p>
            <ul className="event-list">
              {tenants.map((t) => (
                <li key={t.id} className="event-item">
                  <a href={`/admin?tenant=${encodeURIComponent(t.slug)}`}>{t.name}</a>
                  <div className="event-meta">{t.slug}</div>
                </li>
              ))}
            </ul>
            <p style={{ marginTop: "24px" }}>
              <a href="/" className="back-link">← 참여용 지역 목록(메인)</a>
            </p>
          </main>
        </>
      );
    }

    const found = tenants.find((t) => t.slug === slugParam);
    if (!found) {
      return (
        <div style={{ padding: "48px", textAlign: "center" }}>지역을 찾을 수 없습니다.</div>
      );
    }
    tenant = found;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [[row]] = await pool.query<any[]>(
      "SELECT id, slug, name FROM tenant WHERE id = ? LIMIT 1",
      [admin.tenant_id],
    );
    if (!row) {
      return (
        <div style={{ padding: "48px", textAlign: "center" }}>소속 지역을 찾을 수 없습니다.</div>
      );
    }
    tenant = row as Tenant;
    tenants = [tenant];
    if (slugParam && slugParam !== tenant.slug) {
      redirect(`/admin?tenant=${encodeURIComponent(tenant.slug)}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [eventRows] = await pool.query<any[]>(
    "SELECT id, title, description, event_date, is_active, telegram_participant_join_prefix, telegram_participant_leave_prefix FROM event WHERE tenant_id = ? ORDER BY event_date DESC",
    [tenant.id],
  );
  const events = eventRows as Event[];
  const eventIds = events.map((e) => e.id);

  let optionGroups: (OptionGroup & { items: OptionItem[] })[] = [];

  if (eventIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [groupRows] = await pool.query<any[]>(
      "SELECT * FROM option_group WHERE event_id IN (?) ORDER BY event_id, sort_order",
      [eventIds],
    );
    const groups = groupRows as OptionGroup[];
    const groupIds = groups.map((g) => g.id);

    let items: OptionItem[] = [];
    if (groupIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [itemRows] = await pool.query<any[]>(
        "SELECT * FROM option_item WHERE option_group_id IN (?) ORDER BY option_group_id, sort_order",
        [groupIds],
      );
      items = itemRows as OptionItem[];
    }

    optionGroups = groups.map((g) => ({
      ...g,
      items: items.filter((i) => i.option_group_id === g.id),
    }));
  }

  const groupsByEvent: Record<number, (OptionGroup & { items: OptionItem[] })[]> = {};
  optionGroups.forEach((g) => {
    if (!groupsByEvent[g.event_id]) groupsByEvent[g.event_id] = [];
    groupsByEvent[g.event_id].push(g);
  });

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
        <h1>관리 — {tenant.name}</h1>
        <div className="tenant-pills">
          {tenants.length > 1 && (
            <select
              defaultValue={tenant.slug}
              style={{ padding: "8px 14px", borderRadius: "999px", border: "1px solid var(--border)", fontSize: "0.9375rem" }}
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.slug}>{t.name}</option>
              ))}
            </select>
          )}
          <a href={`/t/${tenant.slug}/events`}>이벤트 목록</a>
          <a href={`/admin/tenants/${tenant.slug}`}>관리자 설정</a>
        </div>
        <AdminEventEdit
          tenant={tenant}
          events={events}
          groupsByEvent={groupsByEvent}
        />
      </main>
      <style>{`
        .event-admin-list { list-style: none; padding: 0; margin: 0 0 20px 0; }
        .event-admin-item {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 4px; border-bottom: 1px solid var(--border);
        }
        .event-admin-item:last-child { border-bottom: none; }
        .event-admin-info { flex: 1; }
        .event-admin-title { font-weight: 500; font-size: 0.9375rem; }
        .event-admin-date { font-size: 0.8125rem; color: var(--muted); margin-top: 2px; }
        .badge { font-size: 0.72rem; padding: 2px 8px; border-radius: 999px; font-weight: 500; }
        .badge--on { background: var(--primary-light); color: var(--primary-hover); }
        .badge--off { background: #f3f4f6; color: var(--muted); }
        .event-edit-wrapper { display: none; padding: 10px 0 4px; }
        .event-edit-form .row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
        .event-edit-form .row input, .event-edit-form .row textarea { flex: 1; min-width: 120px; }
        .icon-btn {
          background: none; border: none; cursor: pointer;
          color: var(--muted); padding: 4px; border-radius: 4px; line-height: 0;
        }
        .icon-btn:hover { color: var(--primary); background: var(--bg); }
      `}</style>
    </>
  );
}
