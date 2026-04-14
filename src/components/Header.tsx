interface HeaderProps {
  username?: string | null;
  isAdmin?: boolean;
  canChooseTenant?: boolean;
  tenantSlug?: string;
  showEventListLink?: boolean;
  showAdminLink?: boolean;
  showEventsLink?: boolean;
}

export default function Header({
  username,
  isAdmin,
  canChooseTenant,
  tenantSlug,
  showEventListLink,
  showAdminLink,
  showEventsLink,
}: HeaderProps) {
  const brandHref = canChooseTenant ? "/" : tenantSlug ? `/t/${tenantSlug}/events` : "/";

  const adminHref =
    isAdmin && !canChooseTenant && tenantSlug
      ? `/admin?tenant=${encodeURIComponent(tenantSlug)}`
      : "/admin";

  return (
    <header className="page-header">
      <div className="container">
        <div className="brand">
          <a href={brandHref}>꼬리달기</a>
          {username && <span className="brand-username">({username})</span>}
        </div>
        <nav className="nav-links">
          {showEventListLink && tenantSlug && (
            <a href={`/t/${tenantSlug}/events`}>이벤트 목록</a>
          )}
          {showEventsLink && tenantSlug && (
            <a href={`/t/${tenantSlug}/events`}>이벤트</a>
          )}
          {canChooseTenant && <a href="/">지역 선택</a>}
          {isAdmin && (showAdminLink ? <a href={adminHref}>관리</a> : <a href={adminHref}>관리</a>)}
        </nav>
      </div>
    </header>
  );
}
