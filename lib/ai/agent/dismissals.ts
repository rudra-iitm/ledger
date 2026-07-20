/**
 * Signals the user has waved away.
 *
 * Device-local on purpose. Dismissing "Netflix renews in 2 days" on your
 * phone is a statement about that glance, not a fact about your finances, and
 * it has no business travelling to another device or landing in a backup.
 * Anomaly dismissals, which *are* durable decisions, go through the store's
 * `dismissAlert` instead and live in the ledger where they belong.
 */

const STORAGE_KEY = "ledger:agent-dismissed";
/** Enough to cover a long session; older entries fall off the front. */
const MAX_ENTRIES = 200;

export function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function dismissSignal(id: string): string[] {
  const next = [...readDismissed().filter((entry) => entry !== id), id].slice(-MAX_ENTRIES);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* a full quota just means the dismissal doesn't survive a reload */
    }
  }
  return next;
}

export function clearDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}
