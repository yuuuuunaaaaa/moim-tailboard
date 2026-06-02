import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { queryRows } from "@/lib/queryRows";
import { getPageContext } from "@/lib/auth";
import {
  redirectAdminIfChoose,
  redirectAdminIfRedirect,
  redirectUnlessAdminTenantParam,
  resolveAdminTenant,
} from "@/lib/adminTenant";
import { isSuperadminForTenant } from "@/lib/superadmin";
import { TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";
import Header from "@/components/Header";
import AdminEventEdit from "@/components/AdminEventEdit";
import AutoToast from "@/components/AutoToast";
import TenantSlugPersist from "@/components/TenantSlugPersist";
import type { Event } from "@/types";

interface Props {
  searchParams: Promise<{ tenant?: string; toast?: string }>;
}

export const metadata = { title: "관리 · 꼬리달기" };

const TOAST_TEXT: Record<string, string> = {
  event_toggled_active: "공개로 전환했습니다.",
  event_toggled_inactive: "비공개로 전환했습니다.",
};

export default async function AdminPage({ searchParams }: Props) {
  const { admin, membership, isAdmin } = await getPageContext();
  if (!admin || !membership) redirect("/login");

  const [sp, cookieStore] = await Promise.all([searchParams, cookies()]);
  const slugParam = (sp.tenant ?? "").trim();
  const allowedSlug = cookieStore.get(TENANT_COOKIE_NAME)?.value;

  redirectUnlessAdminTenantParam(slugParam, membership, allowedSlug);

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
  redirectAdminIfRedirect(res);
  redirectAdminIfChoose(res);

  const { tenant } = res;
  const isSuperadmin = isSuperadminForTenant(membership, tenant.id);

  const events = await queryRows<Event>(
    "SELECT id, title, description, event_date, is_active, event_order, telegram_participant_join_prefix, telegram_participant_leave_prefix FROM event WHERE tenant_id = ? ORDER BY event_order ASC, is_active DESC, event_date DESC, id ASC",
    [tenant.id],
  );

  return (
    <>
      <TenantSlugPersist slug={tenant.slug} />
      <Header
        isAdmin={isAdmin}
        tenantSlug={tenant.slug}
        showAdminLink
        showEventListLink
      />
      <div className="page-admin">
        <main className="container container--wide">
          <h1>관리</h1>
          {isSuperadmin && (
            <div className="admin-manage-actions">
              <a href={`/admin/tenants/${tenant.slug}`}>관리자</a>
              <a href={`/admin/tenants/${tenant.slug}/logs`}>로그</a>
              <a href={`/admin/tenants/${tenant.slug}/settings`}>텔레그램</a>
            </div>
          )}
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
