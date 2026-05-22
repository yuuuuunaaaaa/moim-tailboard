"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type TenantOption = { slug: string; name: string };

/** 복수 소속 관리자: `/admin` choose 로만 전환 (우하단 FAB) */
export default function AdminManageTenantBar({ tenants }: { tenants: TenantOption[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const slug = useMemo(() => {
    const fromQuery = searchParams?.get("tenant")?.trim();
    if (fromQuery) return fromQuery;
    const m = pathname?.match(/^\/admin\/tenants\/([^/]+)/);
    return m?.[1]?.trim() ?? "";
  }, [pathname, searchParams]);

  if (tenants.length <= 1 || !slug) return null;

  const tenant = tenants.find((t) => t.slug === slug);
  const label = tenant?.name?.trim() || slug;

  return (
    <a
      href="/admin"
      className="admin-manage-tenant-fab"
      aria-label={`소속 변경 (현재: ${label})`}
      title={`소속 변경 · ${label}`}
    >
      <span className="admin-manage-tenant-fab__text">
        <span>소속</span>
        <span>변경</span>
      </span>
    </a>
  );
}
