export interface PushEnv {
  PUSH?: KVNamespace;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

interface PushSubscriptionJSON {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

interface StoredSubscription {
  subscription: PushSubscriptionJSON;
  dates: string[];
  updatedAt: string;
}

const encoder = new TextEncoder();

function bytesToB64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function keyFor(endpoint: string): string {
  return `sub:${endpoint}`;
}

export async function handleSubscribe(request: Request, env: PushEnv): Promise<number> {
  if (!env.PUSH) return 500;
  let body: { subscription?: PushSubscriptionJSON; dates?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return 400;
  }
  const subscription = body.subscription;
  if (!subscription || typeof subscription.endpoint !== "string") return 400;
  const dates = Array.isArray(body.dates)
    ? body.dates.filter((d): d is string => typeof d === "string")
    : [];
  const stored: StoredSubscription = {
    subscription,
    dates,
    updatedAt: new Date().toISOString(),
  };
  await env.PUSH.put(keyFor(subscription.endpoint), JSON.stringify(stored));
  return 200;
}

export async function handleUnsubscribe(request: Request, env: PushEnv): Promise<number> {
  if (!env.PUSH) return 500;
  let body: { endpoint?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return 400;
  }
  if (!body.endpoint) return 400;
  await env.PUSH.delete(keyFor(body.endpoint));
  return 200;
}

let cachedKey: CryptoKey | null = null;

async function vapidKey(env: PushEnv): Promise<CryptoKey | null> {
  if (cachedKey) return cachedKey;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  const pub = b64urlToBytes(env.VAPID_PUBLIC_KEY);
  const priv = b64urlToBytes(env.VAPID_PRIVATE_KEY);
  if (pub.length !== 65 || priv.length !== 32) return null;
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: bytesToB64url(priv),
    ext: true,
  };
  cachedKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  return cachedKey;
}

async function vapidAuth(endpoint: string, env: PushEnv): Promise<string | null> {
  const key = await vapidKey(env);
  if (!key || !env.VAPID_PUBLIC_KEY) return null;
  const aud = new URL(endpoint).origin;
  const header = bytesToB64url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(
    encoder.encode(
      JSON.stringify({
        aud,
        exp: Math.floor(Date.now() / 1000) + 43200,
        sub: env.VAPID_SUBJECT ?? "mailto:ledger@example.com",
      }),
    ),
  );
  const data = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(data),
  );
  const jwt = `${data}.${bytesToB64url(new Uint8Array(signature))}`;
  return `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`;
}

async function sendPush(endpoint: string, env: PushEnv): Promise<number> {
  const authorization = await vapidAuth(endpoint, env);
  if (!authorization) return 500;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      TTL: "86400",
      Urgency: "normal",
    },
  });
  return response.status;
}

export async function runScheduled(env: PushEnv): Promise<void> {
  if (!env.PUSH) return;
  const today = new Date().toISOString().slice(0, 10);
  let cursor: string | undefined;
  do {
    const list = await env.PUSH.list({ prefix: "sub:", cursor });
    cursor = list.list_complete ? undefined : list.cursor;
    for (const entry of list.keys) {
      const raw = await env.PUSH.get(entry.name);
      if (!raw) continue;
      const stored = JSON.parse(raw) as StoredSubscription;
      const dates = Array.isArray(stored.dates) ? stored.dates : [];
      if (dates.includes(today)) {
        const status = await sendPush(stored.subscription.endpoint, env);
        if (status === 404 || status === 410) {
          await env.PUSH.delete(entry.name);
          continue;
        }
      }
      const future = dates.filter((date) => date >= today);
      if (future.length !== dates.length) {
        await env.PUSH.put(
          entry.name,
          JSON.stringify({ ...stored, dates: future }),
        );
      }
    }
  } while (cursor);
}
