"use client";

import type { Participant } from "@/types";
import Spinner from "@/components/Spinner";
import DuplicateParticipantConfirm from "@/components/DuplicateParticipantConfirm";
import { useParticipantDuplicateSubmit } from "@/lib/useParticipantDuplicateSubmit";

type Props = {
  participant: Participant;
  tenantSlug: string;
  participants: Participant[];
  pendingDeleteId: number | null;
  submittingId: number | null;
  setPendingDeleteId: (id: number | null) => void;
  setEditingId: (id: number | null) => void;
  setSubmittingId: (id: number | null) => void;
  /** owner: 본인 참여 (삭제 = 참여 취소, 방 알림 발송)
   *  admin: 관리자가 다른 사람 참여 편집 (삭제 = 관리자 삭제, 방 알림 없음) */
  role: "owner" | "admin";
  onAdminDelete?: (participantId: number) => void;
};

export default function ParticipantEditForm({
  participant: p,
  tenantSlug,
  participants,
  pendingDeleteId,
  submittingId,
  setPendingDeleteId,
  setEditingId,
  setSubmittingId,
  role,
  onAdminDelete,
}: Props) {
  const {
    formRef,
    showDuplicateConfirm,
    allowDuplicate,
    handleSubmit: handleDuplicateSubmit,
    confirmDuplicateYes,
    confirmDuplicateNo,
  } = useParticipantDuplicateSubmit({ participants, excludeParticipantId: p.id });

  const isDeleting = pendingDeleteId === p.id;
  const isSubmitting = submittingId === p.id;
  const isAdmin = role === "admin";

  return (
    <form
      ref={formRef}
      className="p-edit-form"
      method="post"
      action="/api/participants/update"
      onSubmit={(e) => {
        if (isSubmitting) {
          e.preventDefault();
          return;
        }
        handleDuplicateSubmit(e, () => setSubmittingId(p.id));
      }}
    >
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="participantId" value={p.id} />
      <input type="hidden" name="allowDuplicate" value={allowDuplicate ? "1" : "0"} />
      {/* admin 분기: 삭제 submit 자체를 막고 별도 admin delete API 사용 → mode 는 항상 update */}
      <input
        type="hidden"
        name="mode"
        value={isAdmin ? "update" : isDeleting ? "delete" : "update"}
      />
      <input type="hidden" name="studentNo" value={p.student_no || ""} />
      <div className="p-edit-fields">
        <input type="text" name="name" defaultValue={p.name} placeholder="이름" />
      </div>
      <div className="p-edit-actions">
        <button
          className="btn btn--secondary btn--sm"
          type="submit"
          disabled={isSubmitting || showDuplicateConfirm}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {isSubmitting && <Spinner size={14} label="저장 중" />}
            {isSubmitting ? "저장 중..." : "저장"}
          </span>
        </button>
        <button
          className="btn btn--sm"
          type="button"
          onClick={() => {
            setPendingDeleteId(null);
            setEditingId(null);
          }}
          disabled={isSubmitting}
        >
          닫기
        </button>
        {showDuplicateConfirm && (
          <DuplicateParticipantConfirm
            disabled={isSubmitting}
            onYes={confirmDuplicateYes}
            onNo={confirmDuplicateNo}
          />
        )}
        {isDeleting ? (
          <div
            className="p-delete-confirm"
            role="group"
            aria-label={isAdmin ? "관리자 참여 삭제 확인" : "참여 취소 확인"}
          >
            <span className="p-delete-confirm-text">
              {isAdmin ? "이 참여를 삭제할까요? (방 알림 없음)" : "참여를 취소할까요?"}
            </span>
            <button
              className="btn btn--secondary btn--sm"
              type="button"
              onClick={() => setPendingDeleteId(null)}
              disabled={isSubmitting}
            >
              아니오
            </button>
            {isAdmin ? (
              <button
                className="btn btn--danger btn--sm"
                type="button"
                onClick={() => onAdminDelete?.(p.id)}
                disabled={isSubmitting}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {isSubmitting && <Spinner size={14} label="삭제 중" />}
                  {isSubmitting ? "삭제 중..." : "네, 삭제"}
                </span>
              </button>
            ) : (
              <button className="btn btn--danger btn--sm" type="submit" disabled={isSubmitting}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {isSubmitting && <Spinner size={14} label="삭제 중" />}
                  {isSubmitting ? "처리 중..." : "네, 취소"}
                </span>
              </button>
            )}
          </div>
        ) : (
          <button
            className="btn btn--danger btn--sm"
            type="button"
            disabled={isSubmitting}
            onClick={() => setPendingDeleteId(p.id)}
          >
            삭제
          </button>
        )}
      </div>
    </form>
  );
}
