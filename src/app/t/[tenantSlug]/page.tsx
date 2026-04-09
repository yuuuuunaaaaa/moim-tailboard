import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

export default async function TenantRedirectPage({ params }: Props) {
  const { tenantSlug } = await params;
  redirect(`/t/${tenantSlug}/events`);
}
