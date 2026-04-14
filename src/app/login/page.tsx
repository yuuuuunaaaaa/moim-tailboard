import Script from "next/script";
import Header from "@/components/Header";
import TelegramAuth from "@/components/TelegramAuth";
import TelegramLoginWidget from "@/components/TelegramLoginWidget";

interface Props {
  searchParams: Promise<{ tenantSlug?: string; tenant?: string }>;
}

export const metadata = { title: "할 일 산더미" };

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tenantSlug = (sp.tenantSlug || sp.tenant || "").trim();
  const botName =
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME ||
    "TailboardBot";

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <Header />
      <main className="container">
        <div className="login-page">
          <div className="card login-card">
            <h1>텔레그램으로 로그인</h1>
            <p className="page-subtitle login-subtitle">
              참여 시 본인 확인·수정에 사용됩니다. 서비스는 텔레그램 <strong>공개 사용자명</strong>으로
              로그인합니다. 사용자명이 없으면 텔레그램 설정에서 먼저 사용자명을 만든 뒤 다시 시도해
              주세요.
            </p>
            <TelegramAuth tenantSlug={tenantSlug} loginPage />
            <div className="login-widget-block">
              <TelegramLoginWidget botName={botName} tenantSlug={tenantSlug || undefined} />
            </div>
          </div>
        </div>
      </main>
      <style>{`
        .login-page {
          max-width: 420px;
          margin: 48px auto;
          padding: 0 16px;
        }
        .login-card {
          padding: 28px 24px 32px;
          text-align: center;
        }
        .login-subtitle {
          text-align: left;
          margin-bottom: 20px;
          line-height: 1.55;
          color: #4b5563;
        }
        .login-widget-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 52px;
          margin: 8px 0 4px;
        }
        /* 텔레그램이 넣는 iframe을 카드 가운데에 고정 */
        .telegram-widget-mount {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          min-height: 44px;
        }
        .telegram-widget-mount iframe {
          display: block !important;
          margin: 0 auto !important;
          max-width: 100%;
          border: 0;
          vertical-align: middle;
        }
        .login-back {
          margin-top: 20px;
          margin-bottom: 0;
        }
      `}</style>
    </>
  );
}
