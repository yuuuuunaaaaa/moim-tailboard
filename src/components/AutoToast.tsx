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
      <style>{`
        .toast-overlay {
          position: fixed;
          top: 12px;
          left: 0;
          right: 0;
          z-index: 9999;
          pointer-events: none;
          display: flex;
          justify-content: center;
          padding: 0 12px;
        }
        .toast-banner {
          pointer-events: auto;
          width: min(560px, 100%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid #bbf7d0;
          background: #ecfdf5;
          color: #065f46;
          font-size: 0.95rem;
          box-shadow: 0 10px 30px rgba(0,0,0,0.10);
        }
        .toast-message {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .toast-close {
          flex: 0 0 auto;
          background: transparent;
          border: none;
          color: inherit;
          text-decoration: underline;
          font-weight: 700;
          cursor: pointer;
          padding: 8px 10px;
          min-height: 44px;
        }
      `}</style>
    </div>
  );
}

