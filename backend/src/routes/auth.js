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

// --- Page: login (Telegram Login Widget for desktop) ---
router.get("/login", (req, res) => {
  res.render("login", {
    botName: BOT_NAME,
    authUrl: `${APP_URL}/auth/telegram`,
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

    const payload = {
      username,
      admin_id: admin ? admin.id : null,
      tenant_id: admin ? admin.tenant_id : null,
      via_webapp: true,
    };

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

    const tokenPayload = {
      admin_id: admin.id,
      username: admin.username,
      tenant_id: admin.tenant_id,
    };
    const token = signToken(tokenPayload);

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
    const payload = { ...req.query };
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

    const tokenPayload = {
      username,
      admin_id: admin ? admin.id : null,
      tenant_id: admin ? admin.tenant_id : null,
    };
    const token = signToken(tokenPayload);

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
