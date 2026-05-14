import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPageContext } from "@/lib/auth";
import { queryRows } from "@/lib/queryRows";
import { TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";
import Header from "@/components/Header";
import type { Tenant } from "@/types";

export const metadata = { title: "꼬리달기" };

export default async function HomePage() {
  const { username, isAdmin, canChooseTenant } = await getPageContext();

  /**
   * 로그인한 사용자가 /에 도달한 경우:
   * - 관리 지역이 1개 → 바로 이동
   * - 관리 지역이 여러 개 → 목록 표시 (superadmin 처럼)
   * - 관리자가 아닌 참가자 → 마지막 방문 테넌트 쿠키로 이동 (없으면 안내)
   */
  let myTenants: Pick<Tenant, "id" | "slug" | "name">[] = [];

  if (username && !canChooseTenant) {
    // admin 테이블에서 이 username 이 관리하는 테넌트 전체 조회 (다중 지역 지원)
    myTenants = await queryRows<Pick<Tenant, "id" | "slug" | "name">>(
      `SELECT t.id, t.slug, t.name
       FROM tenant t
       INNER JOIN admin a ON a.tenant_id = t.id
       WHERE a.username = ? AND a.is_superadmin = 0
       ORDER BY t.name ASC`,
      [username],
    );

    if (myTenants.length === 1) {
      // 지역이 하나뿐이면 바로 이동
      redirect(`/t/${encodeURIComponent(myTenants[0].slug)}/events`);
    }

    if (myTenants.length === 0) {
      // 관리자가 아닌 참가자: 쿠키에 저장된 마지막 방문 지역으로 이동
      const cookieStore = await cookies();
      const allowedSlug = cookieStore.get(TENANT_COOKIE_NAME)?.value?.trim();
      if (allowedSlug) {
        redirect(`/t/${encodeURIComponent(allowedSlug)}/events`);
      }
    }
  }

  // superadmin 용 전체 테넌트 목록
  const allTenants: Tenant[] = canChooseTenant
    ? await queryRows<Tenant>("SELECT id, slug, name FROM tenant ORDER BY name ASC")
    : [];

  // 다중 지역 관리자가 표시할 목록
  const displayTenants = canChooseTenant ? allTenants : myTenants;
  const showTenantList = canChooseTenant || myTenants.length > 1;

  return (
    <>
      <Header username={username} isAdmin={isAdmin} canChooseTenant={canChooseTenant} />
      <main className="container">
        {showTenantList ? (
          <>
            <h1>지역 선택</h1>
            <p className="page-subtitle">참여할 지역을 선택하세요.</p>
            {displayTenants.length === 0 ? (
              <div className="empty-state">등록된 지역이 없습니다.</div>
            ) : (
              <ul className="event-list">
                {displayTenants.map((t) => (
                  <li key={t.id} className="event-item">
                    <a href={`/t/${t.slug}/events`}>{t.name}</a>
                    <div className="event-meta">{t.slug}</div>
                  </li>
                ))}
              </ul>
            )}
            {canChooseTenant && (
              <p style={{ marginTop: "24px" }}>
                <a href="/admin" className="btn btn--secondary">관리자 페이지</a>
              </p>
            )}
            {!canChooseTenant && isAdmin && (
              <p style={{ marginTop: "24px" }}>
                <a href="/admin" className="btn btn--secondary">관리자 페이지</a>
              </p>
            )}
          </>
        ) : (
          <>
            <img
              src="/image/telegram-warning.jpg"
              alt="텔레그램"
              style={{ display: "block", margin: "0 auto 12px", width: "100%", height: "auto", borderRadius: "15px" }}
            />
            <p className="page-subtitle">
              소속 텔레그램방 링크가 아닌 외부 링크로 접속하였습니다.
            </p>
            <p className="form-hint" style={{ marginTop: "12px" }}>
              정확한 링크를 통해 접속해주세요.
            </p>
          </>
        )}
      </main>
    </>
  );
}
