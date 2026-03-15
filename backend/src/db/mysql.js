const mysql = require("mysql2/promise");
const fs = require("fs");

// SSL CA: PEM 문자열(Railway env) 또는 파일 경로(로컬)
const sslCaContent = process.env.DB_SSL_CA_CONTENT;
const sslCaPath = process.env.DB_SSL_CA;
let sslOption = {};
if (sslCaContent && sslCaContent.trim()) {
  sslOption = { ssl: { ca: sslCaContent.trim() } };
} else if (sslCaPath && sslCaPath.trim()) {
  try {
    sslOption = { ssl: { ca: fs.readFileSync(sslCaPath.trim()) } };
  } catch (e) {
    console.warn("[db] DB_SSL_CA file not found, connecting without SSL:", e.message);
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 15000,
  ...sslOption,
});

async function testConnection() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
}

async function getTenantOr404(slug, res) {
  const [[row]] = await pool.query(
    "SELECT id, slug, name FROM tenant WHERE slug = ? LIMIT 1",
    [slug],
  );
  if (!row) {
    res.status(404).send("Tenant not found");
    return null;
  }
  return row;
}

module.exports = { pool, getTenantOr404, testConnection };
