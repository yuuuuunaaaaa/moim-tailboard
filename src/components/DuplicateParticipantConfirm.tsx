"use client";

import { DUPLICATE_PARTICIPANT_WARNING } from "@/lib/participantDuplicateShared";

type Props = {
  disabled?: boolean;
  onYes: () => void;
  onNo: () => void;
};

/** 텔레그램 웹뷰 등 window.confirm 대신 인라인 예/아니오. */
export default function DuplicateParticipantConfirm({ disabled, onYes, onNo }: Props) {
  return (
    <div className="p-delete-confirm" role="group" aria-label="중복 참여 확인">
      <span className="p-delete-confirm-text">{DUPLICATE_PARTICIPANT_WARNING}</span>
      <button className="btn btn--secondary btn--sm" type="button" onClick={onNo} disabled={disabled}>
        아니오
      </button>
      <button className="btn btn--primary btn--sm" type="button" onClick={onYes} disabled={disabled}>
        예
      </button>
    </div>
  );
}
