import type { Metadata } from "next";
import { findTenantBySlugCached } from "@/lib/db";

export async function generateMetadata(
  { params }: { params: Promise<{ tenantSlug: string }> },
): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenant = await findTenantBySlugCached(tenantSlug);
  const base = "꼬리달기";
  const title = tenant?.name ? `${tenant.name} ${base}` : base;
  return { title };
}

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return children;
}

