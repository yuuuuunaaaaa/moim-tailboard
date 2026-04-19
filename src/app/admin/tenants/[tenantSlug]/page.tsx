import { redirect } from "next/navigation";
import { findTenantBySlug } from "@/lib/db";
import { queryFirst, queryRows } from "@/lib/queryRows";
import { getPageContext } from "@/lib/auth";
import Header from "@/components/Header";
import TenantSlugPersist from "@/components/TenantSlugPersist";
import type { Admin } from "@/types";

interface Props {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}

const ERROR_MSG: Record<string, string> = {
  username_required: "사용자명을 입력해 주세요.",
  username_duplicate:
    "이 사용자명은 이미 다른 지역의 관리자로 등록되어 있습니다. 한 사람은 한 지역의 관리자만 될 수 있습니다.",
  not_found: "해당 관리자를 찾을 수 없습니다.",
};
const SUCCESS_MSG: Record<string, string> = {
  added: "관리자를 추가했습니다.",
  removed: "관리자를 삭제했습니다.",
};

export default async function AdminTenantPage({ params, searchParams }: Props) {
  const [{ admin, username, isAdmin, canChooseTenant }, { tenantSlug }, sp] = await Promise.all([
    getPageContext(),
    params,
    searchParams,
  ]);
  if (!admin) redirect("/login");

  const tenant = await findTenantBySlug(tenantSlug);
  if (!tenant) {
    return <div style={{ padding: "48px", textAlign: "center" }}>지역을 찾을 수 없습니다.</div>;
  }

  if (!admin.is_superadmin && admin.tenant_id !== tenant.id) {
    const row = await queryFirst<{ slug: string }>(
      "SELECT slug FROM tenant WHERE id = ? LIMIT 1",
      [admin.tenant_id],
    );
    if (row?.slug) {
      redirect(`/admin/tenants/${encodeURIComponent(row.slug)}`);
    }
    return (
      <div style={{ padding: "48px", textAlign: "center" }}>
        <h2>소속 지역만 조회할 수 있습니다.</h2>
      </div>
    );
  }

  const admins = await queryRows<Admin & { created_at: string }>(
    "SELECT id, telegram_id, username, name, created_at FROM admin WHERE tenant_id = ? ORDER BY id ASC",
    [tenant.id],
  );

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

        {sp.error && ERROR_MSG[sp.error] && (
          <p className="alert alert--error" role="alert">{ERROR_MSG[sp.error]}</p>
        )}
        {sp.success && SUCCESS_MSG[sp.success] && (
          <p className="alert alert--success" role="alert">{SUCCESS_MSG[sp.success]}</p>
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
                          <td><code>{a.username}</code></td>
                          <td>{a.name || "—"}</td>
                          <td>{new Date(a.created_at).toLocaleDateString("ko-KR")}</td>
                          <td className="actions">
                            <form
                              method="post"
                              action={`/api/admin/tenants/${tenant.slug}/admins/${a.id}/delete`}
                              style={{ display: "inline" }}
                            >
                              <button type="submit" className="btn btn--danger btn--sm">삭제</button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="admin-card-list admin-only-mobile">
                  {admins.map((a) => (
                    <li key={a.id} className="admin-card">
                      <div className="admin-card-head">
                        <div className="admin-card-title">
                          <div className="admin-card-username"><code>{a.username}</code></div>
                          <div className="admin-card-meta">
                            {a.name ? a.name : "이름 없음"} ·{" "}
                            {new Date(a.created_at).toLocaleDateString("ko-KR")}
                          </div>
                        </div>
                        <form
                          method="post"
                          action={`/api/admin/tenants/${tenant.slug}/admins/${a.id}/delete`}
                        >
                          <button type="submit" className="btn btn--danger btn--sm admin-card-btn">삭제</button>
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
    </>
  );
}
