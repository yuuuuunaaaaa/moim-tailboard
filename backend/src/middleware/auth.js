const jwt = require("jsonwebtoken");
const { pool } = require("../db/mysql");

const JWT_SECRET = process.env.JWT_SECRET;
const UNAUTH_MESSAGE = "This page must be opened from Telegram.";

/** username으로 admin 행 조회 */
async function loadAdminByUsername(username) {
  if (!username) return null;
  const [[row]] = await pool.query(
    "SELECT id, telegram_id, username, tenant_id, name, is_superadmin FROM admin WHERE username = ? LIMIT 1",
    [String(username).trim()],
  );
  return row ? { ...row, is_superadmin: !!row.is_superadmin } : null;
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).send(UNAUTH_MESSAGE);
  if (!JWT_SECRET) return res.status(500).send("Server configuration error");

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.auth = decoded;
    req.admin = await loadAdminByUsername(decoded.username);
    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError") {
      return res.status(401).send(UNAUTH_MESSAGE);
    }
    throw err;
  }
}

async function optionalAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const tokenFromHeader =
    header && header.startsWith("Bearer ") ? header.slice(7) : null;
  const tokenFromCookie = req.cookies && req.cookies.auth_token;
  const token = tokenFromHeader || tokenFromCookie || null;

  if (!token || !JWT_SECRET) return next();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.auth = decoded;
    req.admin = await loadAdminByUsername(decoded.username);
  } catch (err) {
    if (err.name !== "TokenExpiredError" && err.name !== "JsonWebTokenError") {
      return next(err);
    }
  }

  return next();
}

module.exports = { authMiddleware, optionalAuthMiddleware, UNAUTH_MESSAGE };
