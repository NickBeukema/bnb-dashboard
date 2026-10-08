"use client";

import { useEffect } from "react";

/** Registers public/sw.js, which makes the board installable and lets it open offline */
export function ServiceWorker() {
  useEffect(() => {
    // Dev builds change constantly; a worker caching them only gets in the way
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not a secure context (plain http on a LAN address), or blocked. The board works without it.
    });
  }, []);
  return null;
}
