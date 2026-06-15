/* Ledger service worker — offline app shell + due-bill reminders. */
const VERSION = "ledger-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const REMINDERS_KEY = "/__ledger_reminders__";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("ledger-") && !key.startsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === REMINDERS_KEY) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (/\.(?:js|css|woff2?|png|jpg|jpeg|svg|ico|webp|json)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const fallback = await cache.match(self.registration.scope);
    if (fallback) return fallback;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

function localToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function dueReminders() {
  try {
    const cache = await caches.open(`${VERSION}-reminders`);
    const stored = await cache.match(REMINDERS_KEY);
    if (!stored) return [];
    const events = await stored.json();
    const today = localToday();
    return Array.isArray(events)
      ? events.filter((event) => event && event.date === today)
      : [];
  } catch {
    return [];
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const due = await dueReminders();
      if (due.length === 0) return;
      const scope = self.registration.scope;
      const title =
        due.length === 1
          ? due[0].title
          : `${due.length} bills due today`;
      const body =
        due.length === 1
          ? "Due today in Ledger"
          : due.map((event) => event.title).join(", ");
      await self.registration.showNotification(title, {
        body,
        tag: "ledger-reminders",
        badge: `${scope}icon.svg`,
        icon: `${scope}icon.svg`,
        data: { url: `${scope}calendar/` },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) ||
    self.registration.scope;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        if ("focus" in client) {
          client.navigate(client.url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
    })(),
  );
});
