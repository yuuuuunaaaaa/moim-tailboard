"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { hasDuplicateParticipantInList } from "@/lib/participantDuplicateShared";

type ParticipantRow = { id: number; name: string; student_no: string | null };

export function useParticipantDuplicateSubmit(opts: {
  participants: ParticipantRow[];
  excludeParticipantId?: number;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [resubmitAfterAllow, setResubmitAfterAllow] = useState(false);

  useEffect(() => {
    if (!resubmitAfterAllow || !allowDuplicate) return;
    setResubmitAfterAllow(false);
    formRef.current?.requestSubmit();
  }, [resubmitAfterAllow, allowDuplicate]);

  function isDuplicateSubmit(form: HTMLFormElement): boolean {
    if (allowDuplicate) return false;
    const mode = String(new FormData(form).get("mode") ?? "");
    if (mode === "delete") return false;
    const name = String(new FormData(form).get("name") ?? "").trim();
    const studentNo = String(new FormData(form).get("studentNo") ?? "").trim() || null;
    return hasDuplicateParticipantInList(
      opts.participants,
      name,
      studentNo,
      opts.excludeParticipantId,
    );
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>, onProceed: () => void) {
    if (isDuplicateSubmit(e.currentTarget)) {
      e.preventDefault();
      setShowDuplicateConfirm(true);
      return;
    }
    onProceed();
  }

  function confirmDuplicateYes() {
    setAllowDuplicate(true);
    setShowDuplicateConfirm(false);
    setResubmitAfterAllow(true);
  }

  function confirmDuplicateNo() {
    setShowDuplicateConfirm(false);
  }

  return {
    formRef,
    showDuplicateConfirm,
    allowDuplicate,
    handleSubmit,
    confirmDuplicateYes,
    confirmDuplicateNo,
  };
}
