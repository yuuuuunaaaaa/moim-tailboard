"use client";

import { useMemo } from "react";
import type { OptionGroup, OptionItem, Participant } from "@/types";
import Spinner from "@/components/Spinner";
import DuplicateParticipantConfirm from "@/components/DuplicateParticipantConfirm";
import ParticipantOptionInputs from "@/components/ParticipantOptionInputs";
import { buildOptionGroupsWithItems } from "@/lib/participantOptionGroups";
import { submitParticipantRowUpdate } from "@/lib/submitParticipantRowUpdate";
import { useParticipantDuplicateSubmit } from "@/lib/useParticipantDuplicateSubmit";

type Props = {
  participant: Participant;
  eventId: number;
  tenantSlug: string;
  participants: Participant[];
  optionGroups?: OptionGroup[];
  optionItems?: OptionItem[];
  selectedOptionItemIds?: number[];
  pendingDeleteId: number | null;
  submittingId: number | null;
  setPendingDeleteId: (id: number | null) => void;
  setEditingId: (id: number | null) => void;
  setSubmittingId: (id: number | null) => void;
  role: "owner" | "admin";
  onAdminDelete?: (participantId: number) => void;
};

export default function ParticipantEditForm({
  participant: p,
  eventId,
  tenantSlug,
  participants,
  pendingDeleteId,
  submittingId,
  setPendingDeleteId,
  setEditingId,
  setSubmittingId,
  role,
  onAdminDelete,
  optionGroups = [],
  optionItems = [],
  selectedOptionItemIds = [],
}: Props) {
  const groups = useMemo(
    () => buildOptionGroupsWithItems(optionGroups, optionItems),
    [optionGroups, optionItems],
  );

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

  const saveRow = async (formEl: HTMLFormElement) => {
    setSubmittingId(p.id);
    try {
      await submitParticipantRowUpdate({
        eventId,
        tenantSlug,
        participantId: p.id,
        container: formEl,
        groups,
        from: "event",
        allowDuplicate,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.";
      window.alert(msg);
      setSubmittingId(null);
    }
  };

  return (
    <form
      ref={formRef}
      className="p-edit-form"
      data-pid={p.id}
      method="post"
      action="/api/participants/update"
      onSubmit={(e) => {
        if (isSubmitting) {
          e.preventDefault();
          return;
        }
        if (isDeleting) return;

        handleDuplicateSubmit(e, () => {
          e.preventDefault();
          void saveRow(e.currentTarget);
        });
      }}
    >
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="participantId" value={p.id} />
      <input type="hidden" name="allowDuplicate" value={allowDuplicate ? "1" : "0"} />
      <input
        type="hidden"
        name="mode"
        value={isAdmin ? "update" : isDeleting ? "delete" : "update"}
      />
      <input type="hidden" name="studentNo" value={p.student_no || ""} />
      <div className="p-edit-fields">
        <input type="text" name="name" defaultValue={p.name} placeholder="이름" disabled={isSubmitting} />
      </div>
      <ParticipantOptionInputs
        groups={groups}
        selectedOptionItemIds={selectedOptionItemIds}
        disabled={isSubmitting}
        variant="inline"
      />
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
