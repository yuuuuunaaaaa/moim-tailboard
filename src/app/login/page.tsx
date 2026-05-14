import Script from "next/script";
import Header from "@/components/Header";
import TelegramAuth from "@/components/TelegramAuthNoSsr";
import TelegramLoginWidget from "@/components/TelegramLoginWidgetNoSsr";
import {
  extractTenantSlugFromReturnPath,
  sanitizeInternalReturnPath,
} from "@/lib/loginReturnPath";
import { resolveTelegramWebAppOpenConfig } from "@/lib/telegramWebAppOpenUrl";

interface Props {
  searchParams: Promise<{ tenantSlug?: string; tenant?: string; next?: string }>;
}

export const metadata = { title: "할 일 산더미" };

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const safeNext =
    typeof sp.next === "string" ? sanitizeInternalReturnPath(sp.next) : null;
  const fromParams = (sp.tenantSlug || sp.tenant || "").trim();
  const fromNext = safeNext ? extractTenantSlugFromReturnPath(safeNext) : "";
  const tenantSlug = fromParams || fromNext;
  const botName =
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME ||
    "TailboardBot";
  const isLocalWeb =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_LOCAL_PREFER_WEB_LOGIN !== "0";
  const { openUrl: webAppOpenUrl, invalidOpenUrlHint } =
    resolveTelegramWebAppOpenConfig(botName);
  const skipWebAppRedirect =
    isLocalWeb || process.env.NEXT_PUBLIC_TELEGRAM_LOGIN_SKIP_WEBAPP_REDIRECT === "1";
  const widgetFallback =
    isLocalWeb || process.env.NEXT_PUBLIC_TELEGRAM_LOGIN_WIDGET_FALLBACK === "1";
  const widgetRequestAccess =
    process.env.NEXT_PUBLIC_TELEGRAM_WIDGET_REQUEST_ACCESS === "write"
      ? ("write" as const)
      : undefined;

  return (
    <>
      {!isLocalWeb && (
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      )}
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
            {!isLocalWeb && (
              <TelegramAuth
                tenantSlug={tenantSlug}
                postLoginNext={safeNext ?? undefined}
                loginPage
                webAppOpenUrl={webAppOpenUrl}
                skipWebAppRedirect={skipWebAppRedirect}
              />
            )}
            {isLocalWeb && (
              <p className="login-openurl-misconfig" style={{ marginBottom: "18px" }}>
                로컬 개발 모드에서는 웹앱 이동 없이 브라우저 위젯으로 로그인합니다.
              </p>
            )}
            {widgetFallback && (
              <div className="login-widget-fallback">
                <p className="login-widget-fallback-label">
                  브라우저 위젯으로 로그인{isLocalWeb ? "" : " (비상용)"}
                </p>
                <div className="login-widget-block">
                  <TelegramLoginWidget
                    botName={botName}
                    tenantSlug={tenantSlug || undefined}
                    postLoginNext={safeNext ?? undefined}
                    requestAccess={widgetRequestAccess}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
