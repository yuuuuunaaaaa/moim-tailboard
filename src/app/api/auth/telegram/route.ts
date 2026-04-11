import { NextRequest, NextResponse } from "next/server";
import {
  verifyTelegramLoginWidget,
  getLoginWidgetUsername,
} from "@/lib/verifyTelegram";
import { signToken, COOKIE_MAX_AGE } from "@/lib/jwt";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const JWT_READY = !!process.env.JWT_SECRET?.trim();

const cookieOpts = {
  maxAge: COOKIE_MAX_AGE,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/**
 * POST /api/auth/telegram
 * Login Widget JSON 콜백(선택). DB 사용 없음 — Telegram 검증 후 JWT·쿠키만 설정.
 */
export async function POST(request: NextRequest) {
  try {
    if (!BOT_TOKEN.trim()) {
      return NextResponse.json(
        { success: false, error: "Server misconfiguration (TELEGRAM_BOT_TOKEN)" },
        { status: 500 },
      );
    }
    if (!JWT_READY) {
      return NextResponse.json(
        { success: false, error: "Server misconfiguration (JWT_SECRET is not set)" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    if (!verifyTelegramLoginWidget(body, BOT_TOKEN)) {
      return NextResponse.json(
        { success: false, error: "Invalid Telegram login or expired auth_date" },
        { status: 400 },
      );
    }

    const username = getLoginWidgetUsername(body);
    if (!username) {
      return NextResponse.json(
        { success: false, error: "Telegram username is required for this service" },
        { status: 400 },
      );
    }

    const token = await signToken(username);
    const res = NextResponse.json({ success: true, username });
    res.cookies.set("auth_token", token, cookieOpts);
    return res;
  } catch (err) {
    console.error("POST /api/auth/telegram:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/auth/telegram
 * Login Widget 리다이렉트 콜백. tenantSlug/tenant 는 서명에서 제외.
 */
export async function GET(request: NextRequest) {
  try {
    if (!BOT_TOKEN.trim()) {
      return new Response("Server misconfiguration (TELEGRAM_BOT_TOKEN)", { status: 500 });
    }
    if (!JWT_READY) {
      return new Response(
        "Server misconfiguration: JWT_SECRET is not set. Add JWT_SECRET in Vercel Project → Settings → Environment Variables.",
        { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }

    const { searchParams } = request.nextUrl;
    const telegramPayload: Record<string, unknown> = {};
    searchParams.forEach((val, key) => {
      if (key !== "tenantSlug" && key !== "tenant") {
        telegramPayload[key] = val;
      }
    });

    if (!verifyTelegramLoginWidget(telegramPayload, BOT_TOKEN)) {
      return new Response("Invalid Telegram login or expired auth_date", { status: 400 });
    }

    const username = getLoginWidgetUsername(telegramPayload);
    if (!username) {
      return new Response("Telegram username is required for this service", { status: 400 });
    }

    const token = await signToken(username);
    const res = NextResponse.redirect(new URL("/", request.url));
    res.cookies.set("auth_token", token, cookieOpts);
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET /api/auth/telegram:", msg, err);
    const hint =
      msg.includes("JWT_SECRET") || msg.includes("secret")
        ? "JWT signing failed. Set a strong JWT_SECRET in Vercel environment variables."
        : "Internal server error";
    return new Response(hint, { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
