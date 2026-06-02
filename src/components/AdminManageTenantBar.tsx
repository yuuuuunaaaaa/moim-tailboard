"use client";

import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type TenantOption = { slug: string; name: string };

/** 복수 소속 관리자: 다른 지역 꼬리달기 목록으로 전환 (우하단 FAB) */
export default function AdminManageTenantBar({ tenants }: { tenants: TenantOption[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const slug = useMemo(() => {
    const fromQuery = searchParams?.get("tenant")?.trim();
    if (fromQuery) return fromQuery;
    const m = pathname?.match(/^\/admin\/tenants\/([^/]+)/);
    return m?.[1]?.trim() ?? "";
  }, [pathname, searchParams]);

  if (tenants.length <= 1 || !slug) return null;

  const current = tenants.find((t) => t.slug === slug);
  const label = current?.name?.trim() || slug;
  const others = tenants.filter((t) => t.slug !== slug);

  return (
    <div className="admin-manage-tenant-fab-wrap">
      {open && (
        <div
          className="admin-manage-tenant-fab-backdrop"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}
      {open && others.length > 0 && (
        <ul className="admin-manage-tenant-fab-menu" role="menu" aria-label="다른 지역 꼬리달기 목록">
          {others.map((t) => (
            <li key={t.slug} role="none">
              <a
                href={`/t/${encodeURIComponent(t.slug)}/events`}
                className="admin-manage-tenant-fab-menu__item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                {t.name}
              </a>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="admin-manage-tenant-fab"
        aria-label={`다른 지역 목록 (현재: ${label})`}
        aria-expanded={open}
        aria-haspopup="menu"
        title={`다른 지역 · ${label}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="admin-manage-tenant-fab__text">
          <span>지역</span>
          <span>전환</span>
        </span>
      </button>
    </div>
  );
}
