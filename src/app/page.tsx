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
        <h1>지역 선택</h1>
        {canChooseTenant ? (
          <>
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
        ) : isAdmin ? (
          <>
            <p className="page-subtitle">
              일반 관리자는 루트에서 지역을 고를 수 없습니다. 소속 지역의 텔레그램에서 공유된
              꼬리달기·지역 링크로 접속해 주세요.
            </p>
            <p className="form-hint" style={{ marginTop: "12px" }}>
              관리 작업은 해당 링크로 들어온 뒤 <a href="/admin">관리자 페이지</a>에서 진행할 수
              있습니다.
            </p>
          </>
        ) : (
          <>
            <p className="page-subtitle">지역 선택과 관리는 로그인된 관리자만 가능합니다.</p>
            <p className="form-hint">참여할 꼬리달기 링크로 접속해 주세요.</p>
            <p style={{ marginTop: "24px" }}>
              <a href="/login" className="btn btn--secondary">관리자 로그인</a>
            </p>
          </>
        )}
      </main>
    </>
  );
}
