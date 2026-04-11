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
  const botName =
    process.env.TELEGRAM_BOT_NAME ||
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME ||
    "TailboardBot";

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <Header />
      <main className="container">
        <div className="login-page">
          <div className="card">
            <h1>텔레그램으로 로그인</h1>
            <p className="page-subtitle">
              참여 시 본인 확인·수정에 사용됩니다. 서비스는 텔레그램 <strong>공개 사용자명</strong>으로
              로그인합니다. 사용자명이 없으면 아래 버튼으로 로그인하거나, 텔레그램 설정에서 먼저
              사용자명을 만든 뒤 다시 시도해 주세요.
            </p>
            <TelegramAuth tenantSlug={tenantSlug} loginPage />
            {/*
              텔레그램 위젯은 반드시 서버가 렌더한 <script>로 로드해야 함.
              클라이언트에서 createElement('script')로 넣으면 WebApp 자동 로그인 직후 cleanup에
              스크립트가 지워져 버튼이 안 뜨는 경우가 있음.
            */}
            <div className="login-widget-wrap">
              <Script
                src="https://telegram.org/js/telegram-widget.js?22"
                strategy="afterInteractive"
                data-telegram-login={botName}
                data-size="large"
                data-auth-url={authUrl}
                data-request-access="write"
              />
            </div>
            <p style={{ marginTop: 16 }}>
              <a href="/">← 돌아가기</a>
            </p>
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
