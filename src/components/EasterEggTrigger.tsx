"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const HOLD_MS = 5000;

/**
 * 특정 글자를 5초간 길게 누르면 이스터에그 페이지로 이동한다.
 * - pointerdown 에서 타이머 시작, pointerup/leave/cancel 에서 해제.
 * - 진행 중에는 점 색이 서서히 차오르도록 CSS 변수를 애니메이션한다.
 */
export default function EasterEggTrigger({
  children,
  href = "/easter-egg",
}: {
  children: React.ReactNode;
  href?: string;
}) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);

  const clear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setHolding(false);
  };

  const start = () => {
    clear();
    setHolding(true);
    timerRef.current = setTimeout(() => {
      setHolding(false);
      router.push(href);
    }, HOLD_MS);
  };

  return (
    <span
      className={`easter-egg-trigger${holding ? " is-holding" : ""}`}
      onPointerDown={start}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      style={{ ["--ee-duration" as string]: `${HOLD_MS}ms` }}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
