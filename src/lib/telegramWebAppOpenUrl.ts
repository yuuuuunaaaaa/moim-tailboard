/**
 * 브라우저 /login 에서 텔레그램 미니 앱을 열 때 사용하는 t.me 링크.
 *
 * 우선순위:
 * 1) NEXT_PUBLIC_TELEGRAM_WEBAPP_OPEN_URL — BotFather에서 복사한 전체 URL (권장)
 * 2) NEXT_PUBLIC_TELEGRAM_MINI_APP_SHORT_NAME + NEXT_PUBLIC_TELEGRAM_BOT_NAME → https://t.me/{bot}/{short}
 *
 * @see https://core.telegram.org/bots/webapps#direct-link-mini-apps
 */
export function resolveTelegramWebAppOpenUrl(botName: string): string | null {
  const full = process.env.NEXT_PUBLIC_TELEGRAM_WEBAPP_OPEN_URL?.trim();
  if (full) return full;
  const short = process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_SHORT_NAME?.trim();
  const bot = botName.trim();
  if (short && bot) {
    return `https://t.me/${encodeURIComponent(bot)}/${encodeURIComponent(short)}`;
  }
  return null;
}
