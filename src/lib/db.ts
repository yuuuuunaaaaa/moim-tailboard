import { cache } from "react";
import mysql from "mysql2/promise";
import type { Tenant } from "@/types";
import { queryFirst } from "./queryRows";

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
  const underlying =
    (pool as unknown as { pool?: { on?: (event: string, fn: (err: Error) => void) => void } }).pool ??
    (pool as unknown as { on?: (event: string, fn: (err: Error) => void) => void });
  if (underlying && typeof underlying.on === "function") {
    underlying.on("error", (err: Error) => {
      console.error("[db] pool error:", err.message);
    });
  }
} catch {
  // ignore
}

export async function findTenantBySlug(slug: string): Promise<Tenant | null> {
  return queryFirst<Tenant>(
    "SELECT id, slug, name, chat_room_id, event_notice_chat_room_id FROM tenant WHERE slug = ? LIMIT 1",
    [slug],
  );
}

export const findTenantBySlugCached = cache(findTenantBySlug);

export { pool };
