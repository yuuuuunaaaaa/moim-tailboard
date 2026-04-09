import Script from "next/script";
import Header from "@/components/Header";
import TelegramAuth from "@/components/TelegramAuth";

interface Props {
  searchParams: Promise<{ tenantSlug?: string; tenant?: string }>;
}

export const metadata = { title: "텔레그램 로그인 · 꼬리달기" };

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tenantSlug = (sp.tenantSlug || sp.tenant || "").trim();
  const qs = tenantSlug ? `?tenantSlug=${encodeURIComponent(tenantSlug)}` : "";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const authUrl = `${appUrl}/api/auth/telegram${qs}`;
  const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || "TailboardBot";

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <Header />
      <main className="container">
        <div className="login-page">
          <div className="card">
            <h1>텔레그램으로 로그인</h1>
            <p className="page-subtitle">참여 시 본인 확인·수정에 사용됩니다.</p>
            <TelegramAuth tenantSlug={tenantSlug} botName={botName} authUrl={authUrl} />
          </div>
        </div>
      </main>
      <style>{`
        .login-page { max-width: 400px; margin: 48px auto; text-align: center; }
        .login-page .card { padding: 32px; }
        .login-widget-wrap { display: flex; justify-content: center; margin: 24px 0; min-height: 44px; }
      `}</style>
    </>
  );
}
