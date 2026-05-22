import { redirect } from "next/navigation";
import { findTenantBySlug } from "@/lib/db";
import { getPageContext } from "@/lib/auth";
import { isSuperadminForTenant } from "@/lib/superadmin";
import Header from "@/components/Header";
import TenantSlugPersist from "@/components/TenantSlugPersist";

interface Props {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}

const ERROR_MSG: Record<string, string> = {
  invalid_chat_room: "참여 알림 채팅방 ID가 올바르지 않습니다.",
};

export const metadata = { title: "텔레그램 설정 · 꼬리달기" };

function threadInputValue(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) ? String(v) : "";
}

export default async function AdminTenantSettingsPage({ params, searchParams }: Props) {
  const [{ membership, isAdmin }, { tenantSlug }, sp] = await Promise.all([
    getPageContext(),
    params,
    searchParams,
  ]);
  if (!membership) redirect("/login");

  const tenant = await findTenantBySlug(tenantSlug);
  if (!tenant) {
    return <div style={{ padding: "48px", textAlign: "center" }}>지역을 찾을 수 없습니다.</div>;
  }

  if (!isSuperadminForTenant(membership, tenant.id)) {
    return (
      <>
        <Header isAdmin={isAdmin} tenantSlug={tenant.slug} showAdminLink />
        <main className="container">
          <h2>접근 권한 없음</h2>
          <p className="page-subtitle">텔레그램 설정은 해당 지역 최고 관리자만 변경할 수 있습니다.</p>
          <a href={`/admin?tenant=${encodeURIComponent(tenant.slug)}`} className="back-link">← 관리</a>
        </main>
      </>
    );
  }

  return (
    <>
      <TenantSlugPersist slug={tenant.slug} />
      <Header isAdmin={isAdmin} tenantSlug={tenant.slug} showAdminLink showEventListLink />
      <main className="container">
        <a href={`/admin?tenant=${encodeURIComponent(tenant.slug)}`} className="back-link">← 관리</a>
        <h1>텔레그램 설정</h1>
        <p className="page-subtitle">{tenant.name} · 참여/취소 알림 채팅방</p>

        {sp.success === "1" && (
          <p className="alert alert--success" role="alert">저장했습니다.</p>
        )}
        {sp.error && ERROR_MSG[sp.error] && (
          <p className="alert alert--error" role="alert">{ERROR_MSG[sp.error]}</p>
        )}

        <form method="post" action={`/api/admin/tenants/${tenant.slug}/settings`} className="card">
          <div className="form-group">
            <label htmlFor="chat_room_id">참여·취소 알림 채팅방 ID</label>
            <input
              id="chat_room_id"
              name="chat_room_id"
              type="text"
              required
              defaultValue={tenant.chat_room_id ?? "-1"}
            />
            <p className="form-hint">텔레그램 그룹/채널 ID. 포럼이면 아래 토픽 ID도 입력하세요.</p>
          </div>
          <div className="form-group">
            <label htmlFor="chat_room_thread_id">참여 알림 토픽 ID (선택)</label>
            <input
              id="chat_room_thread_id"
              name="chat_room_thread_id"
              type="text"
              inputMode="numeric"
              placeholder="비우면 일반 채팅"
              defaultValue={threadInputValue(tenant.chat_room_thread_id)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="event_notice_chat_room_id">별도 알림 채팅방 ID (선택)</label>
            <input
              id="event_notice_chat_room_id"
              name="event_notice_chat_room_id"
              type="text"
              placeholder="비우면 위 채팅방 사용"
              defaultValue={tenant.event_notice_chat_room_id ?? ""}
            />
          </div>
          <div className="form-group">
            <label htmlFor="event_notice_chat_room_thread_id">별도 알림 토픽 ID (선택)</label>
            <input
              id="event_notice_chat_room_thread_id"
              name="event_notice_chat_room_thread_id"
              type="text"
              inputMode="numeric"
              defaultValue={threadInputValue(tenant.event_notice_chat_room_thread_id)}
            />
          </div>
          <button type="submit" className="btn btn--primary">저장</button>
        </form>
      </main>
    </>
  );
}
