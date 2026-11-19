"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js in production only (in dev it would cache stale bundles).
 * Renders nothing.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }, []);
  return null;
}
