"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** 포인터 다운 시 애니메이션, 포인터 업 시 이스터에그 페이지로 이동한다. */
export default function EasterEggTrigger({
  children,
  href = "/easter-egg",
}: {
  children: React.ReactNode;
  href?: string;
}) {
  const router = useRouter();
  const pressedRef = useRef(false);
  const [holding, setHolding] = useState(false);

  const release = () => {
    pressedRef.current = false;
    setHolding(false);
  };

  return (
    <span
      className={`easter-egg-trigger${holding ? " is-holding" : ""}`}
      onPointerDown={() => {
        pressedRef.current = true;
        setHolding(true);
      }}
      onPointerUp={() => {
        const shouldNavigate = pressedRef.current;
        release();
        if (shouldNavigate) router.push(href);
      }}
      onPointerLeave={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
