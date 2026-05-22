import { getPageContext } from "@/lib/auth";
import { findTenantBySlugCached } from "@/lib/db";

interface HeaderProps {
  isAdmin?: boolean;
  tenantSlug?: string;
  tenantName?: string;
  adminHref?: string;
  showEventListLink?: boolean;
  showAdminLink?: boolean;
  showEventsLink?: boolean;
}

export default async function Header({
  isAdmin: isAdminProp,
  tenantSlug,
  tenantName: tenantNameProp,
  adminHref,
  showEventListLink,
  showAdminLink,
  showEventsLink,
}: HeaderProps) {
  const ctx = await getPageContext();
  const hasAdminAccess = isAdminProp ?? ctx.isAdmin;

  let tenantName = tenantNameProp?.trim() ?? "";
  if (!tenantName && tenantSlug) {
    const tenant = await findTenantBySlugCached(tenantSlug);
    tenantName = tenant?.name?.trim() ?? "";
  }
  const brandLabel = tenantName ? `${tenantName} 꼬리달기` : "꼬리달기";

  const isDevBypass =
    process.env.ALLOW_LOCAL_WITHOUT_AUTH === "1" && process.env.NODE_ENV === "development";
  const brandHref = tenantSlug ? `/t/${tenantSlug}/events` : isDevBypass ? "/?stay=1" : "/";
  const resolvedAdminHref =
    adminHref ??
    (tenantSlug ? `/admin?tenant=${encodeURIComponent(tenantSlug)}` : "/admin");
  const showManageLink = hasAdminAccess && showAdminLink !== false;

  return (
    <header className="page-header">
      <div className="container">
        <div className="brand">
          <a href={brandHref}>{brandLabel}</a>
        </div>
        <nav className="nav-links">
          {showEventListLink && tenantSlug && (
            <a href={`/t/${tenantSlug}/events`}>꼬리달기 목록</a>
          )}
          {showEventsLink && tenantSlug && (
            <a href={`/t/${tenantSlug}/events`}>꼬리달기</a>
          )}
          {showManageLink && <a href={resolvedAdminHref}>관리</a>}
        </nav>
      </div>
    </header>
  );
}
