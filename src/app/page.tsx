import { getPageContext } from "@/lib/auth";
import { queryRows } from "@/lib/queryRows";
import Header from "@/components/Header";
import type { Tenant } from "@/types";

export const metadata = { title: "꼬리달기" };

export default async function HomePage() {
  const { username, isAdmin, canChooseTenant } = await getPageContext();

  const tenants: Tenant[] = canChooseTenant
    ? await queryRows<Tenant>("SELECT id, slug, name FROM tenant ORDER BY name ASC")
    : [];

  return (
    <>
      <Header username={username} isAdmin={isAdmin} canChooseTenant={canChooseTenant} />
      <main className="container">
        {canChooseTenant ? (
          <>
          <h1>지역 선택</h1>
            <p className="page-subtitle">참여할 지역을 선택하세요.</p>
            {tenants.length === 0 ? (
              <div className="empty-state">등록된 지역이 없습니다.</div>
            ) : (
              <ul className="event-list">
                {tenants.map((t) => (
                  <li key={t.id} className="event-item">
                    <a href={`/t/${t.slug}/events`}>{t.name}</a>
                    <div className="event-meta">{t.slug}</div>
                  </li>
                ))}
              </ul>
            )}
            <p style={{ marginTop: "24px" }}>
              <a href="/admin" className="btn btn--secondary">관리자 페이지</a>
            </p>
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
