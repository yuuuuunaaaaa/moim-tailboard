import Script from "next/script";
import Header from "@/components/Header";
import TelegramAuth from "@/components/TelegramAuth";
import TelegramLoginWidget from "@/components/TelegramLoginWidget";
import { resolveTelegramWebAppOpenConfig } from "@/lib/telegramWebAppOpenUrl";

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
  const { openUrl: webAppOpenUrl, invalidOpenUrlHint } =
    resolveTelegramWebAppOpenConfig(botName);
  const skipWebAppRedirect =
    process.env.NEXT_PUBLIC_TELEGRAM_LOGIN_SKIP_WEBAPP_REDIRECT === "1";
  const widgetFallback =
    process.env.NEXT_PUBLIC_TELEGRAM_LOGIN_WIDGET_FALLBACK === "1";
  const widgetRequestAccess =
    process.env.NEXT_PUBLIC_TELEGRAM_WIDGET_REQUEST_ACCESS === "write"
      ? ("write" as const)
      : undefined;

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <Header />
      <main className="container">
        <div className="login-page">
          <div className="card login-card">
            <h1 style={{ marginBottom: "30px" }}>텔레그램으로 로그인</h1>
            {invalidOpenUrlHint && (
              <div className="login-openurl-misconfig" role="alert">
                <strong>환경 변수 안내</strong>
                <p>{invalidOpenUrlHint}</p>
              </div>
            )}
            <TelegramAuth
              tenantSlug={tenantSlug}
              loginPage
              webAppOpenUrl={webAppOpenUrl}
              skipWebAppRedirect={skipWebAppRedirect}
            />
            {widgetFallback && (
              <div className="login-widget-fallback">
                <p className="login-widget-fallback-label">브라우저 위젯으로 로그인 (비상용)</p>
                <div className="login-widget-block">
                  <TelegramLoginWidget
                    botName={botName}
                    tenantSlug={tenantSlug || undefined}
                    requestAccess={widgetRequestAccess}
                  />
                </div>
              </div>
            )}
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
        .login-openurl-misconfig {
          text-align: left;
          margin: 0 0 18px;
          padding: 14px 16px;
          background: #fffbeb;
          border: 1px solid #fcd34d;
          border-radius: 10px;
          font-size: 0.9rem;
          line-height: 1.55;
          color: #78350f;
        }
        .login-openurl-misconfig strong {
          display: block;
          margin-bottom: 8px;
          font-size: 0.95rem;
        }
        .login-openurl-misconfig p {
          margin: 0;
        }
        .login-widget-fallback {
          margin-top: 8px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }
        .login-widget-fallback-label {
          margin: 0 0 12px;
          font-size: 0.8rem;
          color: #9ca3af;
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
        .login-telegram-help {
          margin-top: 24px;
          text-align: left;
          font-size: 0.875rem;
          line-height: 1.55;
          color: #4b5563;
        }
        .login-telegram-help summary {
          cursor: pointer;
          font-weight: 600;
          color: #374151;
        }
        .login-telegram-help ul {
          margin: 12px 0 0;
          padding-left: 1.15rem;
        }
        .login-telegram-help li {
          margin-bottom: 8px;
        }
        .login-telegram-help code {
          font-size: 0.82em;
          background: #f3f4f6;
          padding: 1px 5px;
          border-radius: 4px;
        }
      `}</style>
    </>
  );
}
