import Script from "next/script";
import Header from "@/components/Header";
import TelegramAuth from "@/components/TelegramAuth";
import TelegramLoginWidget from "@/components/TelegramLoginWidget";
import { resolveTelegramWebAppOpenUrl } from "@/lib/telegramWebAppOpenUrl";

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
  const webAppOpenUrl = resolveTelegramWebAppOpenUrl(botName);
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
            <h1>텔레그램으로 로그인</h1>
            <p className="page-subtitle login-subtitle">
              이 화면은 <strong>텔레그램 미니 앱</strong>에서 열리도록 되어 있습니다. 일반 브라우저로
              들어오면 텔레그램 앱으로 안내합니다. 로그인에는 텔레그램{" "}
              <strong>공개 사용자명</strong>이 필요합니다.
            </p>
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
            <details className="login-telegram-help">
              <summary>미니 앱·로그인이 안 될 때</summary>
              <ul>
                <li>
                  BotFather에서 미니 앱 URL이 <code>https://</code>로 시작하는 이 사이트의{" "}
                  <code>/login</code>(또는 동일 도메인)인지 확인하세요.{" "}
                  <code>/setdomain</code> 도메인도 주소창 호스트와 같아야 합니다.
                </li>
                <li>
                  환경 변수 <code>NEXT_PUBLIC_TELEGRAM_WEBAPP_OPEN_URL</code>(t.me 전체 링크) 또는{" "}
                  <code>NEXT_PUBLIC_TELEGRAM_MINI_APP_SHORT_NAME</code>이 봇 설정과 같아야 브라우저에서
                  텔레그램으로 넘어갑니다.
                </li>
                <li>
                  테넌트별로 들어온 경우 <code>startapp</code>으로 지역이 넘어갑니다. 봇 메뉴 URL만
                  쓰는 경우에는 미니 앱 주소에 <code>?tenantSlug=…</code>를 넣을 수도 있습니다.
                </li>
                <li>
                  로컬은 <code>localhost</code> 대신 ngrok 등 HTTPS 공개 URL로 테스트하세요.
                </li>
              </ul>
            </details>
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
