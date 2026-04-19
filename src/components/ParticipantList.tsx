"use client";

import { useState } from "react";
import type { OptionGroup, OptionItem, Participant, ParticipantOption } from "@/types";
import Spinner from "@/components/Spinner";

interface Props {
  participants: Participant[];
  optionGroups: OptionGroup[];
  optionItems: OptionItem[];
  participantOptions: ParticipantOption[];
  username: string | null | undefined;
  tenantSlug: string;
  eventId: number;
  isAdmin?: boolean;
}

export default function ParticipantList({
  participants,
  optionGroups,
  optionItems,
  participantOptions,
  username,
  tenantSlug,
  eventId,
  isAdmin = false,
}: Props) {
  const [showFlat, setShowFlat] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  /** 텔레그램 웹뷰 등에서 window.confirm이 무반응인 경우가 있어 인라인 확인만 사용 */
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const hasOptions = optionGroups.length > 0;

  // 참여자별 선택 옵션 맵
  const participantOptMap: Record<number, ParticipantOption[]> = {};
  participantOptions.forEach((po) => {
    if (!participantOptMap[po.participant_id]) participantOptMap[po.participant_id] = [];
    participantOptMap[po.participant_id].push(po);
  });

  // 옵션 아이템 맵
  const itemMap: Record<number, OptionItem> = {};
  optionItems.forEach((oi) => { itemMap[oi.id] = oi; });

  const deleteAsAdmin = async (participantId: number) => {
    if (submittingId != null) return;
    setSubmittingId(participantId);
    try {
      const fd = new FormData();
      fd.set("tenantSlug", tenantSlug);
      const res = await fetch(`/api/admin/events/${eventId}/participants/${participantId}/delete`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `삭제 실패 (${res.status})`);
      }
      window.location.href = `/t/${encodeURIComponent(tenantSlug)}/events/${eventId}?toast=participant_deleted`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.";
      window.alert(msg);
      setSubmittingId(null);
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="card">
      <div className="card__title-row">
        <h2 className="card__title">참여자 ({participants.length}명)</h2>
        {hasOptions && participants.length > 0 && (
          <button
            type="button"
            className="btn btn--sm btn--secondary"
            onClick={() => setShowFlat((v) => !v)}
          >
            {showFlat ? "옵션별 보기" : "전체 목록"}
          </button>
        )}
      </div>

      {participants.length === 0 ? (
        <p className="empty-state mt-0 mb-0">아직 참여자가 없습니다.</p>
      ) : (
        <>
          {/* 옵션별 그룹 뷰 */}
          {hasOptions && !showFlat && (
            <div id="p-view-grouped">
              {optionGroups.map((group) => {
                const groupItems = optionItems.filter((oi) => oi.option_group_id === group.id);
                return (
                  <div key={group.id} className="p-group-block">
                    <div className="p-group-label">{group.name}</div>
                    {groupItems.map((opt) => {
                      const matched = participants.filter((p) =>
                        (participantOptMap[p.id] || []).some((po) => po.option_item_id === opt.id),
                      );
                      if (matched.length === 0) return null;
                      return (
                        <div key={opt.id} className="p-opt-row">
                          <span className="p-opt-item-name">
                            {opt.name} <span className="p-opt-count">({matched.length}명)</span>
                          </span>
                          <span className="p-opt-names">
                            {matched
                              .map((p) => p.name + (p.student_no ? ` (${p.student_no})` : ""))
                              .join(", ")}
                          </span>
                        </div>
                      );
                    })}
                    {/* 미선택 */}
                    {(() => {
                      const unselected = participants.filter(
                        (p) =>
                          !(participantOptMap[p.id] || []).some(
                            (po) => itemMap[po.option_item_id]?.option_group_id === group.id,
                          ),
                      );
                      if (unselected.length === 0) return null;
                      return (
                        <div className="p-opt-row p-opt-row--none">
                          <span className="p-opt-item-name">
                            미선택 <span className="p-opt-count">({unselected.length}명)</span>
                          </span>
                          <span className="p-opt-names">
                            {unselected
                              .map((p) => p.name + (p.student_no ? ` (${p.student_no})` : ""))
                              .join(", ")}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}

          {/* 전체 목록 */}
          {(!hasOptions || showFlat) && (
            <ul className="p-list" id="p-view-flat">
              {participants.map((p, idx) => {
                const myOpts = participantOptMap[p.id] || [];
                const isEditing = editingId === p.id;
                const isOwner = username && p.username === username;
                const canAdminDelete = isAdmin && !isOwner;
                const isDeletingThis = submittingId === p.id;

                return (
                  <li key={p.id} className="p-item" id={`p-item-${p.id}`}>
                    <div className="p-view" style={{ opacity: isEditing ? 0.5 : 1 }}>
                      <span className="p-num">{idx + 1}</span>
                      <span className="p-info">
                        <span className="p-name">
                          {p.name}
                          {p.student_no && <span className="p-sno"> ({p.student_no})</span>}
                        </span>
                        {hasOptions && myOpts.length > 0 && (
                          <span className="p-opts">
                            {optionGroups.map((group) => {
                              const sels = myOpts
                                .filter(
                                  (po) =>
                                    itemMap[po.option_item_id]?.option_group_id === group.id,
                                )
                                .map((po) => itemMap[po.option_item_id]?.name)
                                .filter(Boolean);
                              if (!sels.length) return null;
                              return (
                                <span key={group.id} className="p-opt-tag">
                                  {sels.join(", ")}
                                </span>
                              );
                            })}
                          </span>
                        )}
                      </span>
                      {(isOwner || canAdminDelete) && (
                        <button
                          className="p-edit-btn"
                          type="button"
                          onClick={() => {
                            setPendingDeleteId(null);
                            setEditingId(isOwner ? (isEditing ? null : p.id) : null);
                            if (canAdminDelete) setPendingDeleteId(p.id);
                          }}
                          title={isOwner ? "수정" : "삭제"}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {isOwner && isEditing && (
                      <form
                        className="p-edit-form"
                        method="post"
                        action="/api/participants/update"
                        onSubmit={() => {
                          if (submittingId != null) return;
                          setSubmittingId(p.id);
                        }}
                      >
                        <input type="hidden" name="tenantSlug" value={tenantSlug} />
                        <input type="hidden" name="participantId" value={p.id} />
                        <div className="p-edit-fields">
                          <input type="text" name="name" defaultValue={p.name} placeholder="이름" />
                          <input
                            type="text"
                            name="studentNo"
                            defaultValue={p.student_no || ""}
                            placeholder="학번(선택)"
                          />
                        </div>
                        <div className="p-edit-actions">
                          <button
                            className="btn btn--secondary btn--sm"
                            type="submit"
                            name="mode"
                            value="update"
                            disabled={submittingId === p.id}
                          >
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              {submittingId === p.id && <Spinner size={14} label="저장 중" />}
                              {submittingId === p.id ? "저장 중..." : "저장"}
                            </span>
                          </button>
                          <button
                            className="btn btn--sm"
                            type="button"
                            onClick={() => {
                              setPendingDeleteId(null);
                              setEditingId(null);
                            }}
                            disabled={submittingId === p.id}
                          >
                            닫기
                          </button>
                          {pendingDeleteId === p.id ? (
                            <div className="p-delete-confirm" role="group" aria-label="참여 취소 확인">
                              <span className="p-delete-confirm-text">참여를 취소할까요?</span>
                              <button
                                className="btn btn--secondary btn--sm"
                                type="button"
                                onClick={() => setPendingDeleteId(null)}
                                disabled={submittingId === p.id}
                              >
                                아니오
                              </button>
                              <button
                                className="btn btn--danger btn--sm"
                                type="submit"
                                name="mode"
                                value="delete"
                                disabled={submittingId === p.id}
                              >
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  {submittingId === p.id && <Spinner size={14} label="삭제 중" />}
                                  {submittingId === p.id ? "처리 중..." : "네, 취소"}
                                </span>
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn--danger btn--sm"
                              type="button"
                              disabled={submittingId === p.id}
                              onClick={() => setPendingDeleteId(p.id)}
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </form>
                    )}

                    {canAdminDelete && pendingDeleteId === p.id && (
                      <div className="p-delete-confirm" role="group" aria-label="관리자 참여 삭제 확인">
                        <span className="p-delete-confirm-text">이 참여를 삭제할까요? (방 알림 없음)</span>
                        <button
                          className="btn btn--secondary btn--sm"
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          disabled={isDeletingThis}
                        >
                          아니오
                        </button>
                        <button
                          className="btn btn--danger btn--sm"
                          type="button"
                          disabled={isDeletingThis}
                          onClick={() => void deleteAsAdmin(p.id)}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            {isDeletingThis && <Spinner size={14} label="삭제 중" />}
                            {isDeletingThis ? "삭제 중..." : "네, 삭제"}
                          </span>
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
