import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ tenant?: string }>;
}

export default async function AdminEventEditPage({ params, searchParams }: Props) {
  const { eventId: eventIdStr } = await params;
  const sp = await searchParams;
  const tenantSlug = (sp.tenant ?? "").trim();
  const qs = new URLSearchParams();
  if (tenantSlug) qs.set("tenant", tenantSlug);
  redirect(`/admin/events/${encodeURIComponent(eventIdStr)}/edit?${qs.toString()}`);
}

