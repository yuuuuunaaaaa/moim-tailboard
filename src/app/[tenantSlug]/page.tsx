import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

/** 짧은 URL(예: /incheon) → 해당 테넌트 이벤트 목록 */
export default async function TenantShortUrlPage({ params }: Props) {
  const { tenantSlug } = await params;
  redirect(`/t/${tenantSlug}/events`);
}
