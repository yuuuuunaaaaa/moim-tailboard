import type { PoolConnection } from "mysql2/promise";
import { pool } from "./db";
import { boundTo } from "./queryRows";

type Db = ReturnType<typeof boundTo>;

export type OptionItemSyncInput = { id?: number; name: string };

export function parseOptionItemsFromFormData(formData: FormData): OptionItemSyncInput[] {
  const ids = formData.getAll("itemId").map(String);
  const names = formData.getAll("itemName").map(String);
  const len = Math.max(ids.length, names.length);
  const items: OptionItemSyncInput[] = [];
  for (let i = 0; i < len; i++) {
    const name = (names[i] ?? "").trim();
    if (!name) continue;
    const idRaw = (ids[i] ?? "").trim();
    const id = idRaw ? Number(idRaw) : undefined;
    items.push({
      id: id != null && Number.isFinite(id) && id > 0 ? id : undefined,
      name,
    });
  }
  return items;
}

export function parseOptionNamesJson(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => String(v).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * 옵션 그룹 항목 동기화. id가 있으면 해당 행 UPDATE(이름·순서), 없으면 INSERT.
 * 폼에서 빠진 기존 id는 DELETE → participant_option 은 해당 항목만 CASCADE.
 */
export async function syncOptionGroupItems(
  groupId: number,
  items: OptionItemSyncInput[],
  db: Db,
): Promise<string[]> {
  const normalized = items
    .map((it) => ({
      id: it.id,
      name: it.name.trim(),
    }))
    .filter((it) => it.name.length > 0);

  const existing = await db.rows<{ id: number }>(
    "SELECT id FROM option_item WHERE option_group_id = ? ORDER BY sort_order ASC, id ASC",
    [groupId],
  );
  const existingIdSet = new Set(existing.map((e) => e.id));
  const kept = new Set<number>();

  for (let i = 0; i < normalized.length; i++) {
    const { id, name } = normalized[i]!;
    if (id != null && existingIdSet.has(id)) {
      await db.exec(
        "UPDATE option_item SET name = ?, sort_order = ? WHERE id = ? AND option_group_id = ?",
        [name, i, id, groupId],
      );
      kept.add(id);
    } else {
      await db.exec(
        "INSERT INTO option_item (option_group_id, name, sort_order) VALUES (?, ?, ?)",
        [groupId, name, i],
      );
    }
  }

  const removeIds = existing.filter((e) => !kept.has(e.id)).map((e) => e.id);
  if (removeIds.length > 0) {
    await db.exec("DELETE FROM option_item WHERE id IN (?) AND option_group_id = ?", [
      removeIds,
      groupId,
    ]);
  }

  return normalized.map((it) => it.name);
}

export async function insertOptionItems(
  groupId: number,
  names: string[],
  db: Db,
): Promise<void> {
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  for (let i = 0; i < trimmed.length; i++) {
    await db.exec(
      "INSERT INTO option_item (option_group_id, name, sort_order) VALUES (?, ?, ?)",
      [groupId, trimmed[i], i],
    );
  }
}

export async function withTransaction<T>(
  fn: (conn: PoolConnection, db: Db) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn, boundTo(conn));
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
