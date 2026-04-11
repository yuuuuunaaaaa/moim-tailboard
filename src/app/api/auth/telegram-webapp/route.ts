import { NextRequest, NextResponse } from "next/server";
import {
  verifyTelegramWebAppInitData,
  getWebAppUsernameFromInitData,
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
 * POST /api/auth/telegram-webapp
 * Mini App initData 검증. 로그인 시 DB 없음. username 필수(공개 사용자명 없으면 실패).
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

    const body = (await request.json()) as { initData?: string };
    const initData = body?.initData;
    if (!initData || typeof initData !== "string") {
      return NextResponse.json({ success: false, error: "initData required" }, { status: 400 });
    }

    if (!verifyTelegramWebAppInitData(initData, BOT_TOKEN)) {
      return NextResponse.json({ success: false, error: "Invalid initData" }, { status: 400 });
    }

    const username = getWebAppUsernameFromInitData(initData);
    if (!username) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Telegram username is required. Set a public username in Telegram settings to use this app.",
        },
        { status: 400 },
      );
    }

    const token = await signToken(username);
    const res = NextResponse.json({ success: true, username });
    res.cookies.set("auth_token", token, cookieOpts);
    return res;
  } catch (err) {
    console.error("POST /api/auth/telegram-webapp:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
