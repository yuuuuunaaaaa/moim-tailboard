import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramLogin, getTelegramUsernameFromPayload } from "@/lib/verifyTelegramLogin";
import { signToken, COOKIE_MAX_AGE } from "@/lib/jwt";
import { pool } from "@/lib/db";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

async function findAdminByUsername(username: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows] = await pool.query<any[]>(
    "SELECT id, telegram_id, username, tenant_id FROM admin WHERE username = ? LIMIT 1",
    [username.trim()],
  );
  return rows[0] ?? null;
}

function normalizeTenantSlug(v: unknown): string | null {
  if (v == null) return null;
  const raw = Array.isArray(v) ? v[0] : v;
  const s = String(raw).trim();
  return s || null;
}

async function insertLoginLog(opts: {
  tenantId: number | null;
  username: string;
  method: string;
  isAdmin: boolean;
  tenantSlug: string | null;
}) {
  if (opts.tenantId == null) return;
  try {
    await pool.query(
      "INSERT INTO action_log (tenant_id, event_id, participant_id, action, metadata) VALUES (?, NULL, NULL, 'LOGIN', JSON_OBJECT('username', ?, 'method', ?, 'isAdmin', ?, 'tenantSlug', ?))",
      [opts.tenantId, opts.username, opts.method, opts.isAdmin ? 1 : 0, opts.tenantSlug ?? null],
    );
  } catch (err) {
    console.error("[auth] action_log LOGIN failed:", (err as Error).message);
  }
}

// POST /api/auth/telegram — Telegram Login Widget (JSON response)
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    if (payload.id == null || !payload.hash) {
      return NextResponse.json({ ok: false, error: "id and hash required" }, { status: 400 });
    }
    if (!BOT_TOKEN) {
      return NextResponse.json({ ok: false, error: "Server misconfiguration" }, { status: 500 });
    }

    const valid = await verifyTelegramLogin(payload, BOT_TOKEN);
    if (!valid) {
      return NextResponse.json({ ok: false, error: "Invalid Telegram login" }, { status: 400 });
    }

    const username = getTelegramUsernameFromPayload(payload);
    if (!username) {
      return NextResponse.json({ ok: false, error: "Missing telegram username/id" }, { status: 400 });
    }

    const admin = await findAdminByUsername(username);
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Not an admin. This login is for administrators only." },
        { status: 403 },
      );
    }

    const slugHint = normalizeTenantSlug(payload.tenantSlug) || normalizeTenantSlug(payload.tenant);
    await insertLoginLog({
      tenantId: admin.tenant_id,
      username,
      method: "telegram_widget",
      isAdmin: true,
      tenantSlug: slugHint,
    });

    const token = signToken({ username, is_admin: true });
    return NextResponse.json({
      ok: true,
      token,
      admin: { id: admin.id, username: admin.username, tenant_id: admin.tenant_id },
    });
  } catch (err) {
    console.error("POST /api/auth/telegram:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/auth/telegram — Login Widget redirect callback (쿠키 설정 후 리다이렉트)
export async function GET(request: NextRequest) {
  try {
    // tenantSlug/tenant 는 우리가 붙인 파라미터 — Telegram 서명에서 제외
    const { searchParams } = request.nextUrl;
    const tsQuery = searchParams.get("tenantSlug");
    const tenantQuery = searchParams.get("tenant");

    // Telegram 서명 파라미터만 추출
    const telegramPayload: Record<string, string | number | undefined> = {};
    searchParams.forEach((val, key) => {
      if (key !== "tenantSlug" && key !== "tenant") {
        telegramPayload[key] = val;
      }
    });

    if (!telegramPayload.hash || telegramPayload.id == null) {
      return new Response("Invalid Telegram login", { status: 400 });
    }
    if (!BOT_TOKEN) {
      return new Response("Server misconfiguration (TELEGRAM_BOT_TOKEN)", { status: 500 });
    }

    const valid = await verifyTelegramLogin(telegramPayload, BOT_TOKEN);
    if (!valid) {
      return new Response("Invalid Telegram login", { status: 400 });
    }

    const username = getTelegramUsernameFromPayload(telegramPayload);
    if (!username) {
      return new Response("Invalid Telegram login", { status: 400 });
    }

    const admin = await findAdminByUsername(username);
    const slugHint = normalizeTenantSlug(tsQuery) || normalizeTenantSlug(tenantQuery);
    const tenantId = admin?.tenant_id ?? null;
    await insertLoginLog({
      tenantId,
      username,
      method: "telegram_widget_redirect",
      isAdmin: !!admin,
      tenantSlug: slugHint,
    });

    const token = signToken({ username, is_admin: true });
    const response = NextResponse.redirect(new URL("/", request.url));

    response.cookies.set("auth_token", token, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    response.cookies.set("username", username, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("GET /api/auth/telegram:", (err as Error).message);
    return new Response("Internal server error", { status: 500 });
  }
}
