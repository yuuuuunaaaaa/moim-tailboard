import mysql from "mysql2/promise";
import type { Tenant } from "@/types";

// Vercel Serverless 환경에서는 connectionLimit을 낮게 유지
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  connectTimeout: 15000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000,
});

try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const underlying = (pool as any).pool || pool;
  if (typeof underlying.on === "function") {
    underlying.on("error", (err: Error) => {
      console.error("[db] pool error:", err.message);
    });
  }
} catch {
  // ignore
}

export async function testConnection() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
}

export async function findTenantBySlug(slug: string): Promise<Tenant | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows] = await pool.query<any[]>(
    "SELECT id, slug, name, chat_room_id FROM tenant WHERE slug = ? LIMIT 1",
    [slug],
  );
  return (rows[0] as Tenant) ?? null;
}

export { pool };
