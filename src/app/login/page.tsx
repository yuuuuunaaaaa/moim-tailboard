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
              참여 시 본인 확인·수정에 사용됩니다. 서비스는 텔레그램 <strong>공개 사용자명</strong>으로
              로그인합니다. 사용자명이 없으면 텔레그램 설정에서 먼저 사용자명을 만든 뒤 다시 시도해
              주세요.
            </p>
            <TelegramAuth tenantSlug={tenantSlug} loginPage />
            <div className="login-widget-block">
              <TelegramLoginWidget
                botName={botName}
                tenantSlug={tenantSlug || undefined}
                requestAccess={widgetRequestAccess}
              />
            </div>
            <details className="login-telegram-help">
              <summary>번호 입력 후 텔레그램에 승인 요청이 안 올 때</summary>
              <ul>
                <li>
                  <strong>@BotFather</strong>에서 <code>/setdomain</code>에 등록한 도메인이{" "}
                  <strong>지금 주소창의 사이트 주소(호스트)</strong>와 같아야 합니다. (
                  <code>https://</code> 없이 호스트만)
                </li>
                <li>
                  <code>NEXT_PUBLIC_TELEGRAM_BOT_NAME</code>은 BotFather에 보이는 봇 사용자명(
                  <code>@</code> 제외)과 같아야 합니다.
                </li>
                <li>
                  입력한 번호로 <strong>텔레그램 앱에 로그인된 계정</strong>이 맞는지, 알림·배터리
                  절전으로 푸시가 막히지 않았는지 확인해 주세요.
                </li>
                <li>
                  카카오톡·문자·다른 앱 <strong>인앱 브라우저</strong>에서는 위젯이 불안정할 수
                  있습니다. Safari·Chrome 등에서 주소를 직접 열어 다시 시도해 보세요.
                </li>
                <li>
                  로컬 <code>localhost</code>는 도메인 등록이 어렵습니다. ngrok 등 HTTPS 공개 URL로
                  접속해 테스트하세요.
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
