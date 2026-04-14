"use client";

import { useMemo, useState } from "react";
import Spinner from "@/components/Spinner";
import type { OptionGroup, OptionItem, Participant } from "@/types";

type GroupWithItems = OptionGroup & { items: OptionItem[] };

export default function AdminParticipantOptionsGrid({
  eventId,
  tenantSlug,
  groups,
  participants,
  participantOptMap,
}: {
  eventId: number;
  tenantSlug: string;
  groups: GroupWithItems[];
  participants: Participant[];
  participantOptMap: Record<number, number[]>; // option_item_id list
}) {
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  const selectedSetByPid = useMemo(() => {
    const m = new Map<number, Set<number>>();
    for (const p of participants) {
      m.set(p.id, new Set(participantOptMap[p.id] || []));
    }
    return m;
  }, [participants, participantOptMap]);

  const saveRow = async (pid: number) => {
    if (submittingId != null) return;
    setSubmittingId(pid);
    try {
      const row = document.querySelector<HTMLTableRowElement>(`tr[data-pid="${pid}"]`);
      if (!row) throw new Error("Row not found");

      const fd = new FormData();
      fd.set("tenantSlug", tenantSlug);
      fd.set("participantId", String(pid));

      // Collect checked/selected inputs for each group from the row.
      for (const g of groups) {
        const key = `g_${g.id}`;
        const inputs = row.querySelectorAll<HTMLInputElement>(`input[name="${key}"]`);
        inputs.forEach((el) => {
          if (el.type === "checkbox") {
            if (el.checked) fd.append(key, el.value);
            return;
          }
          if (el.type === "radio") {
            if (el.checked && el.value !== "") fd.append(key, el.value);
          }
        });
      }

      const res = await fetch(`/api/admin/events/${eventId}/participants/update-one`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Save failed (${res.status})`);
      }

      window.location.href = `/admin/events/${eventId}/edit?tenant=${encodeURIComponent(tenantSlug)}&toast=row_saved`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.";
      window.alert(msg);
      setSubmittingId(null);
    }
  };

  return (
    <div className="participants-wrap admin-participants-wrap">
      <table className="table admin-grid-table">
        <thead>
          <tr>
            <th className="sticky-col sticky-col--left">이름</th>
            {groups.map((g) => (
              <th key={g.id}>{g.name}</th>
            ))}
            <th className="sticky-col sticky-col--right">수정</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((p) => {
            const selected = selectedSetByPid.get(p.id) || new Set<number>();
            const isSubmitting = submittingId === p.id;
            return (
              <tr key={p.id} data-pid={p.id}>
                <td className="sticky-col sticky-col--left">
                  <div style={{ fontWeight: 700 }}>
                    {p.name}
                    {p.student_no ? ` (${p.student_no})` : ""}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    <code>{p.username}</code>
                  </div>
                </td>

                {groups.map((g) => {
                  const key = `g_${g.id}`;
                  const hasAnyInGroup = g.items.some((opt) => selected.has(opt.id));
                  return (
                    <td key={g.id} style={{ minWidth: "220px" }}>
                      {g.items.length === 0 ? (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      ) : g.multiple_select ? (
                        <div className="checkbox-group">
                          {g.items.map((opt) => (
                            <label key={opt.id} style={{ display: "block" }}>
                              <input
                                type="checkbox"
                                name={key}
                                value={opt.id}
                                defaultChecked={selected.has(opt.id)}
                                disabled={isSubmitting}
                              />{" "}
                              {opt.name}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="radio-group">
                          <label style={{ display: "block", color: "var(--muted)" }}>
                            <input
                              type="radio"
                              name={key}
                              value=""
                              defaultChecked={!hasAnyInGroup}
                              disabled={isSubmitting}
                            />{" "}
                            미선택
                          </label>
                          {g.items.map((opt) => (
                            <label key={opt.id} style={{ display: "block" }}>
                              <input
                                type="radio"
                                name={key}
                                value={opt.id}
                                defaultChecked={selected.has(opt.id)}
                                disabled={isSubmitting}
                              />{" "}
                              {opt.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}

                <td className="sticky-col sticky-col--right" style={{ verticalAlign: "top" }}>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => void saveRow(p.id)}
                    disabled={submittingId != null}
                    style={{ minWidth: 92 }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {isSubmitting && <Spinner size={14} color="#fff" label="저장 중" />}
                      {isSubmitting ? "저장 중" : "수정"}
                    </span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <style>{`
        .admin-grid-table .sticky-col {
          position: sticky;
          background: var(--surface);
          z-index: 2;
        }
        .admin-grid-table .sticky-col--left {
          left: 0;
          z-index: 3;
          min-width: 220px;
        }
        .admin-grid-table .sticky-col--right {
          right: 0;
          z-index: 3;
          min-width: 120px;
          text-align: right;
        }
        .admin-grid-table th.sticky-col {
          z-index: 4;
        }
      `}</style>
    </div>
  );
}

