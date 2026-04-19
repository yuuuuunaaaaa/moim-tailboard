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
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpanded = (pid: number) => {
    setExpandedId((cur) => (cur === pid ? null : pid));
    setPendingDeleteId((cur) => (cur === pid ? null : cur));
  };

  const selectedSetByPid = useMemo(() => {
    const m = new Map<number, Set<number>>();
    for (const p of participants) {
      m.set(p.id, new Set(participantOptMap[p.id] || []));
    }
    return m;
  }, [participants, participantOptMap]);

  const saveRow = async (pid: number) => {
    if (submittingId != null) return;
    setPendingDeleteId(null);
    setSubmittingId(pid);
    try {
      const container = document.querySelector<HTMLElement>(`[data-pid="${pid}"]`);
      if (!container) throw new Error("Participant form not found");

      const fd = new FormData();
      fd.set("tenantSlug", tenantSlug);
      fd.set("participantId", String(pid));

      // Collect checked/selected inputs for each group from the row.
      for (const g of groups) {
        const key = `g_${g.id}`;
        const inputs = container.querySelectorAll<HTMLInputElement>(`input[name="${key}"]`);
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

  const deleteRow = async (pid: number) => {
    if (submittingId != null) return;
    setSubmittingId(pid);
    try {
      const fd = new FormData();
      fd.set("tenantSlug", tenantSlug);
      const res = await fetch(`/api/admin/events/${eventId}/participants/${pid}/delete`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `삭제 실패 (${res.status})`);
      }
      window.location.href = `/admin/events/${eventId}/edit?tenant=${encodeURIComponent(tenantSlug)}&toast=participant_deleted`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.";
      window.alert(msg);
      setSubmittingId(null);
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="participants-wrap admin-participants-wrap">
      <div className="admin-participant-list">
        {participants.map((p) => {
          const selected = selectedSetByPid.get(p.id) || new Set<number>();
          const isSubmitting = submittingId === p.id;
          const isExpanded = expandedId === p.id;
          const summaryLabels = groups
            .flatMap((g) => g.items.filter((opt) => selected.has(opt.id)).map((opt) => opt.name));
          const panelId = `admin-p-card-${p.id}`;
          return (
            <section
              key={p.id}
              className={`admin-participant-card${isExpanded ? " admin-participant-card--open" : ""}`}
              data-pid={p.id}
            >
              <header className="admin-participant-card__header">
                <div className="admin-participant-card__identity">
                  <div className="admin-participant-card__name">
                    {p.name}
                    {p.student_no ? ` (${p.student_no})` : ""}
                  </div>
                  <div className="admin-participant-card__username">
                    <code>{p.username}</code>
                  </div>
                  {!isExpanded && summaryLabels.length > 0 && (
                    <div className="admin-participant-card__summary">
                      {summaryLabels.map((label, idx) => (
                        <span key={idx} className="admin-participant-chip">
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm admin-participant-card__toggle"
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  onClick={() => toggleExpanded(p.id)}
                  disabled={submittingId != null && submittingId !== p.id}
                >
                  {isExpanded ? "접기" : "수정"}
                </button>
              </header>

              {isExpanded && (
                <div id={panelId} className="admin-participant-card__body">
                  <div className="admin-participant-card__groups">
                    {groups.map((g) => {
                      const key = `g_${g.id}`;
                      const hasAnyInGroup = g.items.some((opt) => selected.has(opt.id));
                      return (
                        <fieldset key={g.id} className="admin-option-group" disabled={isSubmitting}>
                          <legend className="admin-option-group__title">
                            {g.name}
                            <span className="admin-option-group__meta">
                              {g.multiple_select ? "복수 선택" : "하나만 선택"}
                            </span>
                          </legend>

                          {g.items.length === 0 ? (
                            <span className="admin-option-group__empty">옵션 없음</span>
                          ) : g.multiple_select ? (
                            <div className="admin-option-group__choices">
                              {g.items.map((opt) => (
                                <label key={opt.id} className="admin-option-choice">
                                  <input
                                    type="checkbox"
                                    name={key}
                                    value={opt.id}
                                    defaultChecked={selected.has(opt.id)}
                                    disabled={isSubmitting}
                                  />
                                  <span>{opt.name}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div className="admin-option-group__choices">
                              <label className="admin-option-choice admin-option-choice--muted">
                                <input
                                  type="radio"
                                  name={key}
                                  value=""
                                  defaultChecked={!hasAnyInGroup}
                                  disabled={isSubmitting}
                                />
                                <span>미선택</span>
                              </label>
                              {g.items.map((opt) => (
                                <label key={opt.id} className="admin-option-choice">
                                  <input
                                    type="radio"
                                    name={key}
                                    value={opt.id}
                                    defaultChecked={selected.has(opt.id)}
                                    disabled={isSubmitting}
                                  />
                                  <span>{opt.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </fieldset>
                      );
                    })}
                  </div>

                  {pendingDeleteId === p.id ? (
                    <div className="p-delete-confirm" role="group" aria-label="참여 삭제 확인">
                      <span className="p-delete-confirm-text">
                        이 참여를 삭제할까요? (방 알림 없음)
                      </span>
                      <div className="admin-actions-row">
                        <button
                          type="button"
                          className="btn btn--secondary"
                          onClick={() => setPendingDeleteId(null)}
                          disabled={submittingId != null}
                        >
                          아니오
                        </button>
                        <button
                          type="button"
                          className="btn btn--danger"
                          onClick={() => void deleteRow(p.id)}
                          disabled={submittingId != null}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            {isSubmitting && <Spinner size={14} label="삭제 중" />}
                            {isSubmitting ? "삭제 중" : "네, 삭제"}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="admin-actions-row">
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => void saveRow(p.id)}
                        disabled={submittingId != null}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {isSubmitting && <Spinner size={14} color="#fff" label="저장 중" />}
                          {isSubmitting ? "저장 중" : "변경 저장"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => setPendingDeleteId(p.id)}
                        disabled={submittingId != null}
                      >
                        참여 삭제
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <style>{`
        .admin-participant-list {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        .admin-participant-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 14px 14px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          transition: box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .admin-participant-card--open {
          border-color: rgba(59, 130, 246, 0.35);
          box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08);
        }
        .admin-participant-card__header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }
        .admin-participant-card__identity {
          min-width: 0;
          flex: 1 1 auto;
        }
        .admin-participant-card__toggle {
          flex: 0 0 auto;
          min-height: 36px;
          padding: 6px 14px;
          border-radius: 999px;
        }
        .admin-participant-card__body {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding-top: 2px;
        }
        .admin-participant-card__name {
          font-size: 1rem;
          font-weight: 700;
          overflow-wrap: anywhere;
        }
        .admin-participant-card__username {
          margin-top: 2px;
          font-size: 0.82rem;
          color: var(--muted);
          overflow-wrap: anywhere;
        }
        .admin-participant-card__summary {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .admin-participant-chip {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.14);
          color: var(--fg);
          font-size: 0.78rem;
          line-height: 1.3;
        }
        .admin-participant-card__groups {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .admin-option-group {
          margin: 0;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: 12px;
          min-width: 0;
        }
        .admin-option-group__title {
          width: 100%;
          padding: 0;
          margin-bottom: 10px;
          font-size: 0.95rem;
          font-weight: 700;
        }
        .admin-option-group__meta {
          display: inline-block;
          margin-left: 8px;
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--muted);
        }
        .admin-option-group__empty {
          display: block;
          font-size: 0.9rem;
          color: var(--muted);
        }
        .admin-option-group__choices {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .admin-option-choice {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 44px;
          padding: 10px 12px;
          border-radius: 10px;
          background: var(--surface-muted, rgba(148, 163, 184, 0.08));
          line-height: 1.35;
        }
        .admin-option-choice input {
          flex: 0 0 auto;
          margin: 0;
        }
        .admin-option-choice--muted {
          color: var(--muted);
        }
        .admin-actions-row {
          display: flex;
          flex-direction: row;
          gap: 10px;
          align-items: stretch;
          width: 100%;
        }
        .admin-actions-row > .btn {
          flex: 1 1 0;
          min-height: 44px;
          box-sizing: border-box;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .p-delete-confirm {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px;
          border: 1px solid rgba(239, 68, 68, 0.24);
          border-radius: 12px;
          background: rgba(239, 68, 68, 0.06);
        }
        .p-delete-confirm-text {
          font-size: 0.9rem;
          line-height: 1.4;
        }
        @media (min-width: 768px) {
          .admin-participant-card {
            padding: 18px;
          }
          .admin-participant-card__groups {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}

