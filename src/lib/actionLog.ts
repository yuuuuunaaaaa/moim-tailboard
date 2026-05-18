import { execute } from "@/lib/queryRows";

export const ACTION_VIEW_EVENT = "VIEW_EVENT";
export const ACTION_VIEW_EVENT_LIST = "VIEW_EVENT_LIST";

/** action_log INSERT — metadata 는 JSON_OBJECT 로만 넣어 SQL 인젝션을 피한다 */
export async function insertActionLog(opts: {
  tenantId: number;
  eventId?: number | null;
  participantId?: number | null;
  action: string;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  const meta = opts.metadata ?? {};
  const keys = Object.keys(meta);
  if (keys.length === 0) {
    await execute(
      "INSERT INTO action_log (tenant_id, event_id, participant_id, action) VALUES (?, ?, ?, ?)",
      [opts.tenantId, opts.eventId ?? null, opts.participantId ?? null, opts.action],
    );
    return;
  }

  const placeholders = keys.map((k) => `'${k}', ?`).join(", ");
  const values = keys.map((k) => meta[k]);
  await execute(
    `INSERT INTO action_log (tenant_id, event_id, participant_id, action, metadata)
     VALUES (?, ?, ?, ?, JSON_OBJECT(${placeholders}))`,
    [opts.tenantId, opts.eventId ?? null, opts.participantId ?? null, opts.action, ...values],
  );
}
