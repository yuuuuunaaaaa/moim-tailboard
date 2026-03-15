const jwt = require("jsonwebtoken");
const { pool } = require("../db/mysql");

const JWT_SECRET = process.env.JWT_SECRET;
const UNAUTH_MESSAGE = "This page must be opened from Telegram.";

/**
 * Reads Authorization: Bearer <token>, verifies JWT, and attaches
 * decoded payload to req.auth. If payload contains admin_id, loads
 * admin row and attaches to req.admin.
 */
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).send(UNAUTH_MESSAGE);
  }

  if (!JWT_SECRET) {
    console.error("JWT_SECRET is not set");
    return res.status(500).send("Server configuration error");
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.auth = decoded;

    if (decoded.admin_id != null) {
      const [[admin]] = await pool.query(
        "SELECT id, telegram_id, username, tenant_id, name FROM admin WHERE id = ? LIMIT 1",
        [decoded.admin_id],
      );
      if (admin) {
        req.admin = admin;
      }
    }

    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError") {
      return res.status(401).send(UNAUTH_MESSAGE);
    }
    throw err;
  }
}

/**
 * Optional auth: if Bearer token or auth_token cookie present and valid,
 * sets req.auth and req.admin. Does not send 401 if token is missing.
 */
async function optionalAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const tokenFromHeader =
    header && header.startsWith("Bearer ") ? header.slice(7) : null;
  const tokenFromCookie = req.cookies && req.cookies.auth_token;
  const token = tokenFromHeader || tokenFromCookie || null;

  if (!token || !JWT_SECRET) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.auth = decoded;

    if (decoded.admin_id != null) {
      const [[admin]] = await pool.query(
        "SELECT id, telegram_id, username, tenant_id, name FROM admin WHERE id = ? LIMIT 1",
        [decoded.admin_id],
      );
      if (admin) {
        req.admin = admin;
      }
    }
  } catch {
    // ignore invalid/expired token
  }

  return next();
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  UNAUTH_MESSAGE,
};
