"use client";

import type { CSSProperties } from "react";

export default function Spinner({
  size = 16,
  color = "currentColor",
  label = "로딩",
}: {
  size?: number;
  color?: string;
  label?: string;
}) {
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 9999,
    border: "2px solid rgba(0,0,0,0.15)",
    borderTopColor: color,
    boxSizing: "border-box",
    display: "inline-block",
    verticalAlign: "middle",
    animation: "spin 0.8s linear infinite",
  };

  return <span aria-label={label} role="status" style={style} />;
}
