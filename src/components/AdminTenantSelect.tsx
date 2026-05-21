"use client";

interface Props {
  tenants: { slug: string; name: string }[];
  currentSlug: string;
  basePath?: string;
}

/** 관리 화면에서 소속·관리 가능 지역 전환 */
export default function AdminTenantSelect({
  tenants,
  currentSlug,
  basePath = "/admin",
}: Props) {
  if (tenants.length <= 1) return null;

  return (
    <select
      value={currentSlug}
      onChange={(e) => {
        const slug = e.target.value;
        if (!slug || slug === currentSlug) return;
        const sep = basePath.includes("?") ? "&" : "?";
        window.location.href = `${basePath}${sep}tenant=${encodeURIComponent(slug)}`;
      }}
      style={{
        padding: "8px 14px",
        borderRadius: "999px",
        border: "1px solid var(--border)",
        fontSize: "0.9375rem",
        maxWidth: "100%",
        minWidth: 0,
      }}
    >
      {tenants.map((t) => (
        <option key={t.slug} value={t.slug}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
