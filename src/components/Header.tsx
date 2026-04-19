import { getPageContext } from "@/lib/auth";

interface HeaderProps {
  username?: string | null;
  isAdmin?: boolean;
  canChooseTenant?: boolean;
  tenantSlug?: string;
  adminHref?: string;
  showEventListLink?: boolean;
  showAdminLink?: boolean;
  showEventsLink?: boolean;
}

export default async function Header({
  username,
  isAdmin,
  canChooseTenant,
  tenantSlug,
  adminHref,
  showEventListLink,
  showAdminLink,
  showEventsLink,
}: HeaderProps) {
  const needsContext = username === undefined || isAdmin === undefined || canChooseTenant === undefined;
  const ctx = needsContext ? await getPageContext() : null;
  const displayUsername = username ?? ctx?.username ?? null;
  const hasAdminAccess = isAdmin ?? ctx?.isAdmin ?? false;
  const canPickRegion = canChooseTenant ?? ctx?.canChooseTenant ?? false;

  const isDevBypass = process.env.ALLOW_LOCAL_WITHOUT_AUTH === "1" && process.env.NODE_ENV === "development";
  const regionHref = isDevBypass ? "/?stay=1" : "/";
  const brandHref = canPickRegion ? regionHref : tenantSlug ? `/t/${tenantSlug}/events` : "/";
  const resolvedAdminHref =
    adminHref ?? (!canPickRegion && tenantSlug ? `/admin?tenant=${encodeURIComponent(tenantSlug)}` : "/admin");
  const showManageLink = hasAdminAccess && showAdminLink !== false;

  return (
    <header className="page-header">
      <div className="container">
        <div className="brand">
          <a href={brandHref}>꼬리달기</a>
          {displayUsername && <span className="brand-username">({displayUsername})</span>}
        </div>
        <nav className="nav-links">
          {showEventListLink && tenantSlug && (
            <a href={`/t/${tenantSlug}/events`}>꼬리달기 목록</a>
          )}
          {showEventsLink && tenantSlug && (
            <a href={`/t/${tenantSlug}/events`}>꼬리달기</a>
          )}
          {canPickRegion && <a href={regionHref}>지역 선택</a>}
          {showManageLink && <a href={resolvedAdminHref}>관리</a>}
        </nav>
      </div>
    </header>
  );
}
