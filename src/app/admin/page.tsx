import { redirect } from "next/navigation";
import { queryRows } from "@/lib/queryRows";
import { getPageContext } from "@/lib/auth";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { isSuperadminForTenant } from "@/lib/superadmin";
import Header from "@/components/Header";
import AdminEventEdit from "@/components/AdminEventEdit";
import AdminTenantSelect from "@/components/AdminTenantSelect";
import AutoToast from "@/components/AutoToast";
import TenantSlugPersist from "@/components/TenantSlugPersist";
import type { Event } from "@/types";

interface Props {
  searchParams: Promise<{ tenant?: string; toast?: string }>;
}

export const metadata = { title: "관리 · 꼬리달기" };

// 관리 메인에서 보여줄 수 있는 토스트 종류.
// 다른 라우트(예: 토글 API) 가 redirect URL 에 ?toast=... 를 붙여 전달한다.
const TOAST_TEXT: Record<string, string> = {
  event_toggled_active: "공개로 전환했습니다.",
  event_toggled_inactive: "비공개로 전환했습니다.",
};

export default async function AdminPage({ searchParams }: Props) {
  const { admin, membership, username, isAdmin, canChooseTenant } = await getPageContext();
  if (!admin || !membership) redirect("/login");

  const sp = await searchParams;
  const slugParam = (sp.tenant ?? "").trim();
  const toastKey = (sp.toast ?? "").trim();
  const toastText = TOAST_TEXT[toastKey] ?? "";

  const res = resolveAdminTenant(membership, slugParam);

  if (res.kind === "missing") {
    return (
      <div style={{ padding: "48px", textAlign: "center" }}>
        {res.reason === "admin_tenant_not_found" ? "소속 지역을 찾을 수 없습니다." : "지역을 찾을 수 없습니다."}
      </div>
    );
  }
  if (res.kind === "redirect") {
    redirect(`/admin?tenant=${encodeURIComponent(res.canonicalSlug)}`);
  }

  if (res.kind === "choose") {
    if (res.tenants.length === 0) {
      return <div style={{ padding: "48px", textAlign: "center" }}>등록된 지역이 없습니다.</div>;
    }
    return (
      <>
        <Header
          isAdmin={isAdmin}
          canChooseTenant={canChooseTenant}
          showAdminLink
        />
        <main className="container">
          <h1>관리 — 지역 선택</h1>
          <p className="page-subtitle">관리할 지역을 선택하세요.</p>
          <ul className="event-list">
            {res.tenants.map((t) => (
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

  const { tenant, tenants } = res;
  const isSuperadmin = isSuperadminForTenant(membership, tenant.id);

  // 관리 목록 정렬: 직접 지정한 순서(event_order ASC) → 공개 우선(is_active DESC) → 가까운 날짜(event_date DESC)
  const events = await queryRows<Event>(
    "SELECT id, title, description, event_date, is_active, event_order, telegram_participant_join_prefix, telegram_participant_leave_prefix FROM event WHERE tenant_id = ? ORDER BY event_order ASC, is_active DESC, event_date DESC, id ASC",
    [tenant.id],
  );

  return (
    <>
      <TenantSlugPersist slug={tenant.slug} />
      <Header
        isAdmin={isAdmin}
        canChooseTenant={canChooseTenant}
        tenantSlug={tenant.slug}
        showAdminLink
      />
      <div className="page-admin">
        <main className="container container--wide">
          <h1>관리</h1>
          <div className="tenant-pills">
            <AdminTenantSelect tenants={tenants} currentSlug={tenant.slug} />
            <a href={`/t/${tenant.slug}/events`}>꼬리달기 목록</a>
            {isSuperadmin && (
              <>
                <a href={`/admin/tenants/${tenant.slug}`}>관리자</a>
                <a href={`/admin/tenants/${tenant.slug}/logs`}>로그</a>
                <a href={`/admin/tenants/${tenant.slug}/settings`}>텔레그램</a>
              </>
            )}
          </div>
          <AdminEventEdit tenant={tenant} events={events} />
          {toastText && (
            <AutoToast
              message={toastText}
              clearHref={`/admin?tenant=${encodeURIComponent(tenant.slug)}`}
              timeoutMs={2000}
            />
          )}
        </main>
      </div>
    </>
  );
}
