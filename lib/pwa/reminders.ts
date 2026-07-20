import type { UpcomingEvent } from "@/lib/domain/upcoming";

// Must track VERSION in public/sw.js — the worker reads this same cache.
const REMINDERS_CACHE = "ledger-v2-reminders";
const REMINDERS_KEY = "/__ledger_reminders__";

function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH ?? "";
}

function pushEndpoint(path: string): string | null {
  const base =
    process.env.NEXT_PUBLIC_PUSH_URL ??
    process.env.NEXT_PUBLIC_GITHUB_TOKEN_EXCHANGE_URL;
  if (!base) return null;
  try {
    return new URL(`/push/${path}`, base).toString();
  } catch {
    return null;
  }
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) &&
    Boolean(pushEndpoint("subscribe"))
  );
}

export async function registerServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  try {
    await navigator.serviceWorker.register(`${basePath()}/sw.js`, {
      scope: `${basePath()}/`,
    });
  } catch {
    /* offline support is best-effort */
  }
}

export async function writeReminders(events: UpcomingEvent[]): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(REMINDERS_CACHE);
    await cache.put(
      REMINDERS_KEY,
      new Response(JSON.stringify(events), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch {
    /* best effort */
  }
}

function uniqueDates(events: UpcomingEvent[]): string[] {
  return [...new Set(events.map((event) => event.date))].sort();
}

export async function remindersEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    return Boolean(await registration.pushManager.getSubscription());
  } catch {
    return false;
  }
}

export async function enableReminders(events: UpcomingEvent[]): Promise<void> {
  if (!pushSupported()) throw new Error("Push notifications aren't supported here");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission denied");
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
      ),
    }));
  const endpoint = pushEndpoint("subscribe");
  if (!endpoint) throw new Error("Reminder service is not configured");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription, dates: uniqueDates(events) }),
  });
  if (!response.ok) throw new Error("Couldn't register for reminders");
  await writeReminders(events);
}

export async function disableReminders(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = pushEndpoint("unsubscribe");
  if (endpoint) {
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
    } catch {
      /* unsubscribe locally regardless */
    }
  }
  await subscription.unsubscribe();
}

export async function syncReminders(events: UpcomingEvent[]): Promise<void> {
  await writeReminders(events);
  if (!(await remindersEnabled())) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    const endpoint = pushEndpoint("subscribe");
    if (!subscription || !endpoint) return;
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription, dates: uniqueDates(events) }),
    });
  } catch {
    /* best effort */
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
