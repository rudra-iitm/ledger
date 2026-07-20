"use client";

/**
 * In-app update detection for the installed PWA.
 *
 * An iOS home-screen app can stay alive for days without a real navigation,
 * so a new deploy never reaches it on its own — and Safari gives the user no
 * reload button to force one. Poll a tiny version marker and offer a one-tap
 * restart when the deployed build differs from the running one.
 */

import { toast } from "sonner";

const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const CHECK_EVERY_MS = 15 * 60 * 1000;

let notifiedFor: string | null = null;

async function check(): Promise<void> {
  // Local builds have no meaningful id to compare.
  if (CURRENT === "dev") return;
  try {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const response = await fetch(`${base}/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const { id } = (await response.json()) as { id?: string };
    if (!id || id === CURRENT || notifiedFor === id) return;
    notifiedFor = id;
    // Nudge the service worker so the reload picks up everything fresh.
    void navigator.serviceWorker
      ?.getRegistration()
      .then((registration) => registration?.update())
      .catch(() => undefined);
    toast("Ledger has been updated", {
      description: "Restart to get the latest version.",
      duration: Infinity,
      action: { label: "Restart", onClick: () => window.location.reload() },
    });
  } catch {
    /* offline — the next check will catch it */
  }
}

/** Starts polling (on load, on foreground, and periodically). Returns cleanup. */
export function startUpdateWatch(): () => void {
  const onVisible = () => {
    if (document.visibilityState === "visible") void check();
  };
  void check();
  document.addEventListener("visibilitychange", onVisible);
  const timer = window.setInterval(() => void check(), CHECK_EVERY_MS);
  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(timer);
  };
}
