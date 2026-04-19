"use client";

import dynamic from "next/dynamic";

/** WebApp·window 의존으로 SSR 시 트리가 달라질 수 있어 클라이언트 전용 로드 (hydration #418 방지) */
export default dynamic(() => import("./TelegramAuth"), { ssr: false });
