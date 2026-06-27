"use client";

type Props = {
  message: string;
  onClose: () => void;
};

/** 텔레그램 웹뷰 등 window.alert 대신 전체 화면 모달 알림 */
export default function AlertModal({ message, onClose }: Props) {
  return (
    <div
      className="alert-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-modal-message"
      onClick={onClose}
    >
      <div className="alert-modal" onClick={(e) => e.stopPropagation()}>
        <p id="alert-modal-message" className="alert-modal-message">
          {message}
        </p>
        <button type="button" className="btn btn--primary alert-modal-btn" onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
}
