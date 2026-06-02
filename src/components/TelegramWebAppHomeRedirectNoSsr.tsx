"use client";

import dynamic from "next/dynamic";

export default dynamic(() => import("./TelegramWebAppHomeRedirect"), { ssr: false });
