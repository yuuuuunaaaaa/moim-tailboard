const express = require("express");
const jwt = require("jsonwebtoken");
const { pool } = require("../db/mysql");
const {
  verifyTelegramWebApp,
  parseUserFromInitData,
} = require("../auth/verifyTelegramWebApp");
const {
  verifyTelegramLogin,
  getTelegramUsernameFromPayload,
} = require("../auth/verifyTelegramLogin");

const router = express.Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || "90d";
const _appUrl = (process.env.APP_URL || "http://localhost:3000").trim();
const APP_URL = /^https?:\/\//.test(_appUrl) ? _appUrl : "https://" + _appUrl;
const BOT_NAME = process.env.TELEGRAM_BOT_NAME || "TailboardBot";

function signToken(payload) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Look up admin by Telegram username (한국에서 말하는 "텔레그램 ID").
 * admin.username = 사용자명, admin.telegram_id = 숫자 id (nullable).
 */
async function findAdminByUsername(username) {
  const [[row]] = await pool.query(
    "SELECT id, telegram_id, username, tenant_id FROM admin WHERE username = ? LIMIT 1",
    [String(username).trim()],
  );
  return row || null;
}

/** 쿼리/바디 등에서 slug 한 개로 정규화 */
function normalizeTenantSlugInput(v) {
  if (v == null) return null;
  const raw = Array.isArray(v) ? v[0] : v;
  const s = String(raw).trim();
  return s || null;
}

/** Referer 등 절대 URL에서 /t/:slug/ 패턴 추출 (비관리자는 링크에 slug 포함 전제) */
function tenantSlugFromReferer(referer) {
  if (!referer || typeof referer !== "string") return null;
  try {
    const u = new URL(referer);
    const m = u.pathname.match(/^\/t\/([^/]+)\/?/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

async function getTenantIdBySlug(slug) {
  if (!slug) return null;
  const [[row]] = await pool.query("SELECT id FROM tenant WHERE slug = ? LIMIT 1", [slug]);
  return row ? row.id : null;
}

/**
 * action_log.tenant_id: 관리자는 admin.tenant_id,
 * 비관리자는 요청에 실린 tenant slug(명시) 또는 Referer의 /t/slug/ 만 사용.
 */
async function resolveLoginTenantForLog({ admin, tenantSlug }) {
  if (admin && admin.tenant_id != null) return admin.tenant_id;
  if (!tenantSlug) return null;
  return getTenantIdBySlug(tenantSlug);
}

/** 로그인 감사 로그 (실패해도 로그인 응답은 유지) */
async function insertLoginActionLog({ tenantId, username, method, isAdmin, tenantSlug }) {
  if (tenantId == null) return;
  try {
    await pool.query(
      "INSERT INTO action_log (tenant_id, event_id, participant_id, action, metadata) VALUES (?, NULL, NULL, 'LOGIN', JSON_OBJECT('username', ?, 'method', ?, 'isAdmin', ?, 'tenantSlug', ?))",
      [tenantId, String(username).trim(), String(method), isAdmin ? 1 : 0, tenantSlug || null],
    );
  } catch (err) {
    console.error("[auth] action_log LOGIN failed:", err.message);
  }
}

// --- Page: login (Telegram Login Widget for desktop) ---
router.get("/login", (req, res) => {
  const tenantSlug =
    normalizeTenantSlugInput(req.query.tenantSlug) ||
    normalizeTenantSlugInput(req.query.tenant) ||
    "";
  const qs = tenantSlug ? `?tenantSlug=${encodeURIComponent(tenantSlug)}` : "";
  res.render("login", {
    botName: BOT_NAME,
    authUrl: `${APP_URL}/auth/telegram${qs}`,
    loginTenantSlug: tenantSlug,
  });
});

// --- A) Telegram WebApp Login (mobile) ---
// POST /auth/telegram-webapp
// Body: { initData } (from Telegram.WebApp.initData)
// Verifies initData, extracts user, optionally resolves admin; returns JWT.
router.post("/auth/telegram-webapp", async (req, res) => {
  try {
    const { initData } = req.body || {};
    if (!initData) {
      return res.status(400).json({ ok: false, error: "initData required" });
    }
    if (!BOT_TOKEN) {
      return res.status(500).json({ ok: false, error: "Server misconfiguration" });
    }

    const valid = await verifyTelegramWebApp(initData, BOT_TOKEN);
    if (!valid) {
      return res.status(400).json({ ok: false, error: "Invalid initData" });
    }

    const user = await parseUserFromInitData(initData);
    if (!user || user.id == null) {
      return res.status(400).json({ ok: false, error: "No user in initData" });
    }

    const username =
      user.username != null && String(user.username).trim() !== ""
        ? String(user.username).trim()
        : String(user.id);
    const admin = await findAdminByUsername(username);

    const slugHint =
      normalizeTenantSlugInput((req.body || {}).tenantSlug) ||
      tenantSlugFromReferer(req.get("Referer"));
    const tenantId = await resolveLoginTenantForLog({ admin, tenantSlug: slugHint });
    await insertLoginActionLog({
      tenantId,
      username,
      method: "telegram_webapp",
      isAdmin: !!admin,
      tenantSlug: slugHint,
    });

    const payload = { username, via_webapp: true };

    const token = signToken(payload);
    return res.json({
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
  } catch (err) {
    console.error("POST /auth/telegram-webapp:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// --- B) Telegram Login Widget (desktop browser) ---
// POST /auth/telegram
// Body: { id, hash, auth_date [, first_name, last_name, username, photo_url ] }
// Verifies hash, ensures user is in admin table; returns JWT.
router.post("/auth/telegram", async (req, res) => {
  try {
    const payload = req.body || {};
    if (payload.id == null || !payload.hash) {
      return res.status(400).json({ ok: false, error: "id and hash required" });
    }
    if (!BOT_TOKEN) {
      return res.status(500).json({ ok: false, error: "Server misconfiguration" });
    }

    const valid = await verifyTelegramLogin(payload, BOT_TOKEN);
    if (!valid) {
      return res.status(400).json({ ok: false, error: "Invalid Telegram login" });
    }

    const username = getTelegramUsernameFromPayload(payload);
    if (!username) {
      return res.status(400).json({ ok: false, error: "Missing telegram username/id" });
    }

    const admin = await findAdminByUsername(username);
    if (!admin) {
      return res.status(403).json({
        ok: false,
        error: "Not an admin. This login is for administrators only.",
      });
    }

    const slugHint =
      normalizeTenantSlugInput(req.body.tenantSlug) ||
      normalizeTenantSlugInput(req.body.tenant) ||
      tenantSlugFromReferer(req.get("Referer"));
    await insertLoginActionLog({
      tenantId: admin.tenant_id,
      username,
      method: "telegram_widget",
      isAdmin: true,
      tenantSlug: slugHint,
    });

    const token = signToken({ username });

    return res.json({
      ok: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        tenant_id: admin.tenant_id,
      },
    });
  } catch (err) {
    console.error("POST /auth/telegram:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// Optional: GET /auth/telegram (redirect from Login Widget with query params)
// Verifies and issues JWT; redirects to / with token in cookie for backward compat.
router.get("/auth/telegram", async (req, res) => {
  try {
    // tenantSlug/tenant 는 우리가 붙인 파라미터 — Telegram 서명에 포함되지 않으므로 분리
    const { tenantSlug: tsQuery, tenant: tenantQuery, ...telegramPayload } = req.query;
    const payload = telegramPayload;

    if (!payload.hash || payload.id == null) {
      return res.status(400).send("Invalid Telegram login");
    }
    if (!BOT_TOKEN) {
      console.error("GET /auth/telegram: TELEGRAM_BOT_TOKEN is not set");
      return res.status(500).send("Server misconfiguration (TELEGRAM_BOT_TOKEN)");
    }
    if (!JWT_SECRET) {
      console.error("GET /auth/telegram: JWT_SECRET is not set");
      return res.status(500).send("Server misconfiguration (JWT_SECRET)");
    }

    const valid = await verifyTelegramLogin(payload, BOT_TOKEN);
    if (!valid) {
      return res.status(400).send("Invalid Telegram login");
    }

    const username = getTelegramUsernameFromPayload(payload);
    const admin = await findAdminByUsername(username);
    const slugHint =
      normalizeTenantSlugInput(tsQuery) ||
      normalizeTenantSlugInput(tenantQuery) ||
      tenantSlugFromReferer(req.get("Referer"));
    const tenantId = await resolveLoginTenantForLog({ admin, tenantSlug: slugHint });
    await insertLoginActionLog({
      tenantId,
      username,
      method: "telegram_widget_redirect",
      isAdmin: !!admin,
      tenantSlug: slugHint,
    });

    const token = signToken({ username });

    res.cookie("auth_token", token, {
      maxAge: 90 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    });
    res.cookie("username", username, {
      maxAge: 90 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    });
    return res.redirect("/");
  } catch (err) {
    console.error("GET /auth/telegram:", err.message || err);
    return res.status(500).send("Internal server error");
  }
});

module.exports = router;
