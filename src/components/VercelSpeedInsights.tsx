"use client";

import { useEffect, useState } from "react";

/**
 * Dev에서 Next RSC 번들이 vendor-chunks를 못 찾는 케이스가 있어
 * SpeedInsights는 production에서만 동적으로 로드합니다.
 */
export default function VercelSpeedInsights() {
  const [Comp, setComp] = useState<null | (() => React.ReactNode)>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    let mounted = true;
    import("@vercel/speed-insights/next")
      .then((m) => {
        if (!mounted) return;
        const SpeedInsights = m.SpeedInsights as unknown as () => React.ReactNode;
        setComp(() => SpeedInsights);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (process.env.NODE_ENV !== "production") return null;
  if (!Comp) return null;
  return <Comp />;
}

