export default function Loading() {
  return (
    <div className="page-loading" role="status" aria-live="polite" aria-label="로딩">
      <span className="spinner" />
      <style>{`
        .page-loading {
          min-height: 60vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 20px;
        }
        .spinner {
          width: 28px;
          height: 28px;
          border-radius: 9999px;
          border: 3px solid rgba(0,0,0,0.12);
          border-top-color: var(--primary);
          box-sizing: border-box;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

