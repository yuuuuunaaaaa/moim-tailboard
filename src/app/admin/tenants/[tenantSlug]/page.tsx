import { redirect } from "next/navigation";
import { pool, findTenantBySlug } from "@/lib/db";
import { getPageContext } from "@/lib/auth";
import Header from "@/components/Header";
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

  const canAccess = admin.is_superadmin || admin.tenant_id === tenant.id;
  if (!canAccess) {
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
      <Header
        username={username}
        isAdmin={isAdmin}
        canChooseTenant={canChooseTenant}
        tenantSlug={tenantSlug}
        showAdminLink
        showEventsLink
      />
      <main className="container container--wide">
        <a href="/admin" className="back-link">← 관리</a>
        <h1>{tenant.name} · 관리자</h1>
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
                  required
                  placeholder="예: yuna9354 (@ 없이)"
                />
              </div>
              <div className="form-group">
                <label htmlFor="adminName">
                  표시 이름 <span className="optional">(선택)</span>
                </label>
                <input id="adminName" name="name" placeholder="예: 홍길동" />
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
              <div className="participants-wrap">
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
                            onSubmit={undefined}
                          >
                            <button
                              type="submit"
                              className="btn btn--danger"
                              onClick={undefined}
                            >
                              삭제
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
      <style>{`
        .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 0.9375rem; }
        .alert--error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
        .alert--success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; }
        .admin-list-table .actions { white-space: nowrap; }
      `}</style>
    </>
  );
}
