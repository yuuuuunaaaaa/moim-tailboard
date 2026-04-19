"use client";

import dynamic from "next/dynamic";

/** 위젯이 ref에 스크립트를 붙여 DOM을 바꿔 hydration과 충돌할 수 있어 클라이언트 전용 */
export default dynamic(() => import("./TelegramLoginWidget"), { ssr: false });
