import { getPageContext } from "@/lib/auth";
import { pool } from "@/lib/db";

interface HeaderProps {
  username?: string | null;
  isAdmin?: boolean;
  canChooseTenant?: boolean;
  tenantSlug?: string;
  showEventListLink?: boolean;
  showAdminLink?: boolean;
  showEventsLink?: boolean;
}

async function tenantSlugById(tenantId: number): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [[row]] = await pool.query<any[]>("SELECT slug FROM tenant WHERE id = ? LIMIT 1", [tenantId]);
  return (row?.slug as string | undefined) ?? null;
}

export default async function Header({
  username,
  canChooseTenant,
  tenantSlug,
  showEventListLink,
  showAdminLink,
  showEventsLink,
}: HeaderProps) {
  const ctx = await getPageContext();
  const admin = ctx.admin;
  const displayUsername = username ?? ctx.username;
  const isSuperAdmin = !!admin?.is_superadmin;
  const canPickRegion = canChooseTenant ?? isSuperAdmin;

  const brandHref = canPickRegion ? "/" : tenantSlug ? `/t/${tenantSlug}/events` : "/";

  let adminHref = "/admin";
  if (admin && !isSuperAdmin) {
    const slug = await tenantSlugById(admin.tenant_id);
    adminHref = slug ? `/admin?tenant=${encodeURIComponent(slug)}` : "/admin";
  }

  const showManageLink = !!admin && (showAdminLink !== false);

  return (
    <header className="page-header">
      <div className="container">
        <div className="brand">
          <a href={brandHref}>꼬리달기</a>
          {displayUsername && <span className="brand-username">({displayUsername})</span>}
        </div>
        <nav className="nav-links">
          {showEventListLink && tenantSlug && (
            <a href={`/t/${tenantSlug}/events`}>이벤트 목록</a>
          )}
          {showEventsLink && tenantSlug && (
            <a href={`/t/${tenantSlug}/events`}>이벤트</a>
          )}
          {canPickRegion && <a href="/">지역 선택</a>}
          {showManageLink && <a href={adminHref}>관리</a>}
        </nav>
      </div>
    </header>
  );
}
