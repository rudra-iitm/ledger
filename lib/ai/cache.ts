/**
 * Response cache, keyed on the exact request.
 *
 * Most AI calls in a ledger are re-asked with identical inputs: reopening
 * last month's review, re-rendering the health advisor, categorising the same
 * merchant string that appears on every statement. Caching those is the
 * single biggest lever on both latency and the user's Google bill.
 *
 * Deliberately *not* IndexedDB: entries are small, the access pattern is
 * synchronous-read-before-fetch, and localStorage keeps the whole AI subsystem
 * free of async init. Entries are pruned by TTL first, then LRU.
 */

const CACHE_STORAGE = "ledger:ai-cache";
const MAX_ENTRIES = 120;
/** Roughly 2 MB of the ~5 MB localStorage budget; the ledger owns the rest. */
const MAX_CHARS = 2_000_000;

export interface CacheEntry<T = unknown> {
  value: T;
  /** Epoch ms when this entry stops being served. */
  expiresAt: number;
  /** Epoch ms of the last read — the LRU key. */
  usedAt: number;
}

type CacheMap = Record<string, CacheEntry>;

/**
 * FNV-1a, twice with different offsets, hex-joined.
 *
 * Not cryptographic and doesn't need to be: the worst case for a collision is
 * one wrong cached answer for one user, and a 64-bit space makes that
 * vanishingly unlikely across the ~120 entries we ever hold.
 */
export function hashKey(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

function read(): CacheMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as CacheMap;
  } catch {
    return {};
  }
}

function write(map: CacheMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_STORAGE, JSON.stringify(map));
  } catch {
    // Quota exceeded: the cache is pure optimisation, so drop it entirely
    // rather than leaving a half-written map behind.
    try {
      window.localStorage.removeItem(CACHE_STORAGE);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Drop expired entries, then the least-recently-used ones until the map fits
 * both the entry-count and character budgets. Pure: takes and returns a map.
 */
export function prune(map: CacheMap, now: number): CacheMap {
  const live = Object.entries(map).filter(([, entry]) => entry.expiresAt > now);
  live.sort((a, b) => b[1].usedAt - a[1].usedAt);

  const kept: CacheMap = {};
  let chars = 0;
  let count = 0;
  for (const [key, entry] of live) {
    const size = JSON.stringify(entry).length;
    if (count >= MAX_ENTRIES || chars + size > MAX_CHARS) break;
    kept[key] = entry;
    chars += size;
    count += 1;
  }
  return kept;
}

export function getCached<T>(key: string): T | null {
  const map = read();
  const entry = map[key];
  if (!entry) return null;
  const now = Date.now();
  if (entry.expiresAt <= now) {
    delete map[key];
    write(map);
    return null;
  }
  entry.usedAt = now;
  map[key] = entry;
  write(map);
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlSeconds: number): void {
  if (ttlSeconds <= 0) return;
  const now = Date.now();
  const map = read();
  map[key] = { value, expiresAt: now + ttlSeconds * 1000, usedAt: now };
  write(prune(map, now));
}

export function clearAiCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHE_STORAGE);
  } catch {
    /* ignore */
  }
}

export function aiCacheSize(): number {
  return Object.keys(read()).length;
}

/** Common TTLs, named so call sites read as intent rather than arithmetic. */
export const TTL = {
  /** Volatile: today's numbers change as the user adds rows. */
  short: 15 * 60,
  /** A working session. */
  medium: 6 * 60 * 60,
  /** Closed months and finished documents never change. */
  long: 30 * 24 * 60 * 60,
} as const;
