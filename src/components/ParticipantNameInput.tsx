"use client";

import { useState, type InputHTMLAttributes } from "react";
import {
  PARTICIPANT_NAME_FORBIDDEN_MESSAGE,
  stripForbiddenParticipantNameChars,
} from "@/lib/participantName";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "name" | "onInput">;

/** 이름 입력 — 쉼표·슬래시·앰퍼샌드는 입력·붙여넣기 즉시 제거하고 안내를 띄운다. */
export default function ParticipantNameInput(props: Props) {
  const [blocked, setBlocked] = useState(false);

  return (
    <>
      <input
        {...props}
        type="text"
        name="name"
        onInput={(e) => {
          const el = e.currentTarget;
          const next = stripForbiddenParticipantNameChars(el.value);
          if (next === el.value) return;
          const removed = el.value.length - next.length;
          const caret = Math.max((el.selectionStart ?? next.length) - removed, 0);
          el.value = next;
          el.setSelectionRange(caret, caret);
          setBlocked(true);
        }}
      />
      {blocked && (
        <p className="form-hint form-hint--warning participant-name-hint" role="alert">
          {PARTICIPANT_NAME_FORBIDDEN_MESSAGE}
        </p>
      )}
    </>
  );
}
