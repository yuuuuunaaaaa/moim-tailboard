import { getPageContext } from "@/lib/auth";
import { findTenantBySlugCached } from "@/lib/db";

interface HeaderProps {
  isAdmin?: boolean;
  canChooseTenant?: boolean;
  tenantSlug?: string;
  /** slug 조회 없이 이름만 넘길 때 (선택) */
  tenantName?: string;
  adminHref?: string;
  showEventListLink?: boolean;
  showAdminLink?: boolean;
  showEventsLink?: boolean;
}

export default async function Header({
  isAdmin,
  canChooseTenant,
  tenantSlug,
  tenantName: tenantNameProp,
  adminHref,
  showEventListLink,
  showAdminLink,
  showEventsLink,
}: HeaderProps) {
  const needsContext = isAdmin === undefined || canChooseTenant === undefined;
  const ctx = needsContext ? await getPageContext() : null;
  const hasAdminAccess = isAdmin ?? ctx?.isAdmin ?? false;
  const canPickRegion = canChooseTenant ?? ctx?.canChooseTenant ?? false;

  let tenantName = tenantNameProp?.trim() ?? "";
  if (!tenantName && tenantSlug) {
    const tenant = await findTenantBySlugCached(tenantSlug);
    tenantName = tenant?.name?.trim() ?? "";
  }
  const brandLabel = tenantName ? `${tenantName} 꼬리달기` : "꼬리달기";

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
          <a href={brandHref}>{brandLabel}</a>
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
