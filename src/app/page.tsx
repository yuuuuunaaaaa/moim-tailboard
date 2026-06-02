import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Script from "next/script";
import { getPageContext } from "@/lib/auth";
import { TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";
import Header from "@/components/Header";
import TelegramWebAppHomeRedirect from "@/components/TelegramWebAppHomeRedirectNoSsr";
import type { Tenant } from "@/types";

export const metadata = { title: "꼬리달기" };

export default async function HomePage() {
  const { username, isAdmin, managedTenants } = await getPageContext();

  const myTenants: Pick<Tenant, "id" | "slug" | "name">[] = isAdmin
    ? managedTenants.map((t) => ({ id: t.id, slug: t.slug, name: t.name }))
    : [];

  const cookieStore = await cookies();
  const allowedSlug = cookieStore.get(TENANT_COOKIE_NAME)?.value?.trim();

  if (username && allowedSlug) {
    redirect(`/t/${encodeURIComponent(allowedSlug)}/events`);
  }

  if (username && isAdmin && myTenants.length === 1) {
    redirect(`/t/${encodeURIComponent(myTenants[0]!.slug)}/events`);
  }

  return (
    <>
      {username && (
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      )}
      {username && <TelegramWebAppHomeRedirect />}
      <Header isAdmin={isAdmin} />
      <main className="container">
        <img
          src="/image/telegram-warning.jpg"
          alt="텔레그램"
          style={{ display: "block", margin: "0 auto 12px", width: "100%", height: "auto", borderRadius: "15px" }}
        />
        <p className="page-subtitle">
          소속 텔레그램방 링크가 아닌 외부 링크로 접속하였습니다.
        </p>
        <p className="form-hint" style={{ marginTop: "12px" }}>
          정확한 링크를 통해 접속해주세요.
        </p>
      </main>
    </>
  );
}
