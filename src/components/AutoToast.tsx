"use client";

import { useEffect, useState } from "react";

export default function AutoToast({
  message,
  clearHref,
  timeoutMs = 2000,
}: {
  message: string;
  /** toast 파라미터 제거용(닫기/자동닫기 시 이동할 URL) */
  clearHref: string;
  timeoutMs?: number;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setOpen(false);
      try {
        window.history.replaceState(null, "", clearHref);
      } catch {
        // ignore
      }
    }, timeoutMs);
    return () => window.clearTimeout(t);
  }, [clearHref, timeoutMs]);

  if (!open) return null;

  return (
    <div className="toast-overlay" role="status" aria-live="polite">
      <div className="toast-banner">
        <span className="toast-message">{message}</span>
        <button
          type="button"
          className="toast-close"
          onClick={() => {
            setOpen(false);
            try {
              window.history.replaceState(null, "", clearHref);
            } catch {
              window.location.href = clearHref;
            }
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}

