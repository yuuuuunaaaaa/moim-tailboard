"use client";

import { useMemo, useState } from "react";
import Spinner from "@/components/Spinner";
import ParticipantOptionInputs from "@/components/ParticipantOptionInputs";
import type { OptionGroupWithItems } from "@/lib/participantOptionGroups";
import { submitParticipantRowUpdate } from "@/lib/submitParticipantRowUpdate";
import type { Participant } from "@/types";

export default function AdminParticipantOptionsGrid({
  eventId,
  tenantSlug,
  groups,
  participants,
  participantOptMap,
}: {
  eventId: number;
  tenantSlug: string;
  groups: OptionGroupWithItems[];
  participants: Participant[];
  participantOptMap: Record<number, number[]>;
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

      await submitParticipantRowUpdate({
        eventId,
        tenantSlug,
        participantId: pid,
        container,
        groups,
        from: "admin",
      });
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
                  <div className="admin-participant-card__name-edit">
                    <label
                      htmlFor={`admin-p-name-${p.id}`}
                      className="admin-participant-card__name-label"
                    >
                      이름
                    </label>
                    <input
                      id={`admin-p-name-${p.id}`}
                      type="text"
                      name="name"
                      defaultValue={p.name}
                      placeholder="이름"
                      disabled={isSubmitting}
                    />
                  </div>
                  <ParticipantOptionInputs
                    groups={groups}
                    selectedOptionItemIds={[...selected]}
                    disabled={isSubmitting}
                    variant="admin"
                  />

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
    </div>
  );
}
