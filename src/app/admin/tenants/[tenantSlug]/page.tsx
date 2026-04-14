import { redirect } from "next/navigation";
import { pool, findTenantBySlug } from "@/lib/db";
import { getPageContext } from "@/lib/auth";
import Header from "@/components/Header";
import TenantSlugPersist from "@/components/TenantSlugPersist";
import type { Admin } from "@/types";

interface Props {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}

export default async function AdminTenantPage({ params, searchParams }: Props) {
  const { admin, username, isAdmin, canChooseTenant } = await getPageContext();
  if (!admin) redirect("/login");

  const { tenantSlug } = await params;
  const sp = await searchParams;

  const tenant = await findTenantBySlug(tenantSlug);
  if (!tenant) {
    return <div style={{ padding: "48px", textAlign: "center" }}>지역을 찾을 수 없습니다.</div>;
  }

  if (!admin.is_superadmin && admin.tenant_id !== tenant.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [[row]] = await pool.query<any[]>("SELECT slug FROM tenant WHERE id = ? LIMIT 1", [
      admin.tenant_id,
    ]);
    const mySlug = row?.slug as string | undefined;
    if (mySlug) {
      redirect(`/admin/tenants/${encodeURIComponent(mySlug)}`);
    }
    return (
      <div style={{ padding: "48px", textAlign: "center" }}>
        <h2>소속 지역만 조회할 수 있습니다.</h2>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [adminRows] = await pool.query<any[]>(
    "SELECT id, telegram_id, username, name, created_at FROM admin WHERE tenant_id = ? ORDER BY id ASC",
    [tenant.id],
  );
  const admins = adminRows as (Admin & { created_at: string })[];

  const errorMsg: Record<string, string> = {
    username_required: "사용자명을 입력해 주세요.",
    username_duplicate:
      "이 사용자명은 이미 다른 지역의 관리자로 등록되어 있습니다. 한 사람은 한 지역의 관리자만 될 수 있습니다.",
    not_found: "해당 관리자를 찾을 수 없습니다.",
  };
  const successMsg: Record<string, string> = {
    added: "관리자를 추가했습니다.",
    removed: "관리자를 삭제했습니다.",
  };

  return (
    <>
      <TenantSlugPersist slug={tenant.slug} />
      <Header
        username={username}
        isAdmin={isAdmin}
        canChooseTenant={canChooseTenant}
        tenantSlug={tenant.slug}
        showAdminLink
        showEventsLink
      />
      <main className="container container--wide">
        <a href={`/admin?tenant=${encodeURIComponent(tenant.slug)}`} className="back-link">← 관리</a>
        <h1>관리자</h1>
        <p className="page-subtitle">
          이 지역의 관리자를 추가·삭제할 수 있습니다. 사용자명으로 식별됩니다.
        </p>

        {sp.error && errorMsg[sp.error] && (
          <p className="alert alert--error" role="alert">{errorMsg[sp.error]}</p>
        )}
        {sp.success && successMsg[sp.success] && (
          <p className="alert alert--success" role="alert">{successMsg[sp.success]}</p>
        )}

        <div className="admin-grid">
          <div className="card">
            <h2 className="card__title">관리자 추가</h2>
            <form method="post" action={`/api/admin/tenants/${tenant.slug}/admins`}>
              <div className="form-group">
                <label htmlFor="username">
                  사용자명 <span className="optional">(필수)</span>
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  placeholder="예: ebcblue (@ 없이)"
                />
              </div>
              <div className="form-group">
                <label htmlFor="adminName">
                  표시 이름 <span className="optional">(선택)</span>
                </label>
                <input id="adminName" name="name" type="text" placeholder="예: 홍길동" />
              </div>
              <button className="btn btn--primary" type="submit">관리자 추가</button>
            </form>
          </div>

          <div className="card">
            <h2 className="card__title">현재 관리자 ({admins.length}명)</h2>
            {admins.length === 0 ? (
              <p className="empty-state mt-0 mb-0">
                등록된 관리자가 없습니다. 위 폼에서 추가해 주세요.
              </p>
            ) : (
              <>
                {/* Desktop/tablet: table */}
                <div className="participants-wrap admin-only-desktop">
                  <table className="table admin-list-table">
                    <thead>
                      <tr>
                        <th>사용자명</th>
                        <th>이름</th>
                        <th>추가일</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <code>{a.username}</code>
                          </td>
                          <td>{a.name || "—"}</td>
                          <td>{new Date(a.created_at).toLocaleDateString("ko-KR")}</td>
                          <td className="actions">
                            <form
                              method="post"
                              action={`/api/admin/tenants/${tenant.slug}/admins/${a.id}/delete`}
                              style={{ display: "inline" }}
                            >
                              <button type="submit" className="btn btn--danger btn--sm">
                                삭제
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: card list */}
                <ul className="admin-card-list admin-only-mobile">
                  {admins.map((a) => (
                    <li key={a.id} className="admin-card">
                      <div className="admin-card-head">
                        <div className="admin-card-title">
                          <div className="admin-card-username">
                            <code>{a.username}</code>
                          </div>
                          <div className="admin-card-meta">
                            {a.name ? a.name : "이름 없음"} ·{" "}
                            {new Date(a.created_at).toLocaleDateString("ko-KR")}
                          </div>
                        </div>
                        <form
                          method="post"
                          action={`/api/admin/tenants/${tenant.slug}/admins/${a.id}/delete`}
                        >
                          <button type="submit" className="btn btn--danger btn--sm admin-card-btn">
                            삭제
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </main>
      <style>{`
        .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 0.9375rem; }
        .alert--error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
        .alert--success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; }
        .admin-list-table .actions { white-space: nowrap; }

        .admin-card-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .admin-card {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 10px 12px;
          margin: 3px 0;
        }
        .admin-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .admin-card-username { font-weight: 700; }
        .admin-card-meta { margin-top: 4px; font-size: 0.875rem; color: var(--muted); line-height: 1.4; }
        .admin-card-btn { min-height: 44px; }

        /* 모바일 전용 UI: 테이블 숨기고 카드로 */
        @media (max-width: 640px) {
          .admin-only-desktop { display: none; }
          .admin-only-mobile { display: block; }
          .btn { width: 100%; }
        }
        @media (min-width: 641px) {
          .admin-only-desktop { display: block; }
          .admin-only-mobile { display: none; }
        }
      `}</style>
    </>
  );
}
