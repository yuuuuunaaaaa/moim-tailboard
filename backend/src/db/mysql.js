const mysql = require("mysql2/promise");
const fs = require("fs");
require("dotenv").config();

// SSL CA: 파일 경로(로컬) 또는 PEM 문자열(Railway 등 env에 붙여넣기)
const sslCaContent = process.env.DB_SSL_CA_CONTENT;
const sslCaPath = process.env.DB_SSL_CA;
let sslOption = {};
if (sslCaContent && sslCaContent.trim()) {
  sslOption = { ssl: { ca: sslCaContent.trim() } };
} else if (sslCaPath && sslCaPath.trim()) {
  sslOption = { ssl: { ca: fs.readFileSync(sslCaPath.trim()) } };
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ...sslOption,
});

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

module.exports = { pool, getTenantOr404 };