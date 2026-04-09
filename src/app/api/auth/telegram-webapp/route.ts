import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramWebApp, parseUserFromInitData } from "@/lib/verifyTelegramWebApp";
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

async function getTenantIdBySlug(slug: string): Promise<number | null> {
  if (!slug) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows] = await pool.query<any[]>(
    "SELECT id FROM tenant WHERE slug = ? LIMIT 1",
    [slug],
  );
  return rows[0]?.id ?? null;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { initData, tenantSlug: bodySlug } = body ?? {};

    if (!initData) {
      return NextResponse.json({ ok: false, error: "initData required" }, { status: 400 });
    }
    if (!BOT_TOKEN) {
      return NextResponse.json({ ok: false, error: "Server misconfiguration" }, { status: 500 });
    }

    const valid = await verifyTelegramWebApp(initData, BOT_TOKEN);
    if (!valid) {
      return NextResponse.json({ ok: false, error: "Invalid initData" }, { status: 400 });
    }

    const user = await parseUserFromInitData(initData);
    if (!user || user.id == null) {
      return NextResponse.json({ ok: false, error: "No user in initData" }, { status: 400 });
    }

    const username =
      user.username != null && String(user.username).trim() !== ""
        ? String(user.username).trim()
        : String(user.id);

    const admin = await findAdminByUsername(username);
    const slugHint = normalizeTenantSlug(bodySlug);
    const tenantId =
      admin?.tenant_id ?? (slugHint ? await getTenantIdBySlug(slugHint) : null);

    await insertLoginLog({
      tenantId,
      username,
      method: "telegram_webapp",
      isAdmin: !!admin,
      tenantSlug: slugHint,
    });

    const token = signToken({
      username,
      via_webapp: true,
      ...(admin ? { is_admin: true } : {}),
    });

    const response = NextResponse.json({
      ok: true,
      token,
      user: {
        id: user.id,
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        username: user.username || "",
      },
      admin: admin
        ? { id: admin.id, username: admin.username, tenant_id: admin.tenant_id }
        : null,
    });

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
    console.error("POST /api/auth/telegram-webapp:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
