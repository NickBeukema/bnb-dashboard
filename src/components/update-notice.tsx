"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { BUILD_ID } from "@/lib/version";

const CHECK_MS = 5 * 60 * 1000;
const TOAST_ID = "new-version";

/**
 * Offers a refresh once a newer build has been deployed. An installed app can stay open for days
 * on old code; pages come from the network first, so a reload is all it takes to update.
 */
export function UpdateNotice() {
  useEffect(() => {
    // Dev builds all share one id, and reload themselves anyway
    if (process.env.NODE_ENV !== "production") return;
    let showing = false;
    // Dismissed with "Later": ask again next time the app is opened, not every few minutes
    let snoozed = false;

    const check = async () => {
      if (showing || snoozed) return;
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        if (!response.ok) return;
        const { version } = (await response.json()) as { version?: unknown };
        if (typeof version !== "string" || version === BUILD_ID || showing) return;
        showing = true;
        const snooze = () => {
          showing = false;
          snoozed = true;
        };
        toast("A new version of the board is ready.", {
          id: TOAST_ID,
          duration: Infinity,
          action: { label: "Refresh", onClick: () => location.reload() },
          cancel: { label: "Later", onClick: snooze },
          onDismiss: snooze,
        });
      } catch {
        // Offline: check again later
      }
    };

    check();
    const timer = setInterval(check, CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      snoozed = false;
      check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", check);
    };
  }, []);
  return null;
}
