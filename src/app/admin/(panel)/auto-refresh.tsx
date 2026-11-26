"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refresh at most this often when coming back to the app. */
const MIN_GAP_MS = 5_000;
/** While the panel is open on screen, refresh this often. */
const INTERVAL_MS = 60_000;

/**
 * Keeps the panel's data current. An installed app (iPhone/Android) is not
 * reloaded when you switch back to it: it shows whatever it had in memory.
 * This re-fetches the page data (no full reload, typed text is kept):
 *   · when the app comes back to the foreground,
 *   · every minute while it's visible,
 *   · when a push notification arrives (message from the service worker).
 * Renders nothing.
 */
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();
    const refresh = (force = false) => {
      if (document.visibilityState !== "visible") return;
      // Don't swap the data under someone who is typing in a form.
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return;
      if (!force && Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      router.refresh();
    };

    const onVisible = () => refresh();
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) refresh(true); // restored from the back/forward cache
    };
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "refresh") refresh(true);
    };
    const timer = setInterval(() => refresh(true), INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onPageShow);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [router]);

  return null;
}
