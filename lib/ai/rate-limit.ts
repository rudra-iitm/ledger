/**
 * Client-side spend guards.
 *
 * The user is paying Google directly, so the app's job is to make a runaway
 * loop impossible rather than to meter revenue. Three independent guards:
 *
 *  - a token bucket, so bursts (categorising 300 imported rows) drip instead
 *    of tripping Gemini's per-minute limit and failing the whole batch;
 *  - a concurrency gate, because ten parallel calls from one screen is never
 *    what the user meant;
 *  - a daily call ceiling, the backstop against a bug that loops forever.
 *
 * The bucket is pure and injectable so it can be tested without waiting for
 * real seconds to pass.
 */

export interface TokenBucketOptions {
  /** Bucket size — the largest burst allowed from cold. */
  capacity: number;
  /** Sustained rate, tokens added per second. */
  refillPerSecond: number;
  now?: () => number;
}

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly now: () => number;

  constructor(private readonly options: TokenBucketOptions) {
    this.now = options.now ?? (() => Date.now());
    this.tokens = options.capacity;
    this.lastRefill = this.now();
  }

  private refill(): void {
    const at = this.now();
    const elapsedSeconds = (at - this.lastRefill) / 1000;
    if (elapsedSeconds <= 0) return;
    this.tokens = Math.min(
      this.options.capacity,
      this.tokens + elapsedSeconds * this.options.refillPerSecond,
    );
    this.lastRefill = at;
  }

  /** Take one token if available. */
  tryTake(): boolean {
    this.refill();
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }

  /** Milliseconds until a token frees up; 0 when one is available now. */
  waitMs(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    return Math.ceil(((1 - this.tokens) / this.options.refillPerSecond) * 1000);
  }

  get available(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

const DAILY_CAP = 400;
const DAILY_STORAGE = "ledger:ai-daily";

interface DailyCount {
  day: string;
  count: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readDaily(): DailyCount {
  if (typeof window === "undefined") return { day: today(), count: 0 };
  try {
    const raw = window.localStorage.getItem(DAILY_STORAGE);
    const parsed = raw ? (JSON.parse(raw) as DailyCount) : null;
    if (!parsed || parsed.day !== today()) return { day: today(), count: 0 };
    return parsed;
  } catch {
    return { day: today(), count: 0 };
  }
}

export function dailyCallsRemaining(): number {
  return Math.max(0, DAILY_CAP - readDaily().count);
}

export function noteDailyCall(): void {
  if (typeof window === "undefined") return;
  try {
    const current = readDaily();
    window.localStorage.setItem(
      DAILY_STORAGE,
      JSON.stringify({ day: current.day, count: current.count + 1 }),
    );
  } catch {
    /* ignore */
  }
}

export const DAILY_CALL_CAP = DAILY_CAP;

/** 10 calls of burst, ~1 every 2s sustained: generous for a person, not a loop. */
const bucket = new TokenBucket({ capacity: 10, refillPerSecond: 0.5 });

let inFlight = 0;
const MAX_CONCURRENT = 3;
const waiters: (() => void)[] = [];

function releaseSlot(): void {
  inFlight -= 1;
  const next = waiters.shift();
  if (next) next();
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Wait for a concurrency slot and a bucket token, then run `fn`.
 * Returns whatever `fn` returns; always frees the slot.
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (inFlight >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  inFlight += 1;
  try {
    for (;;) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (bucket.tryTake()) break;
      await sleep(Math.min(bucket.waitMs(), 1000), signal);
    }
    return await fn();
  } finally {
    releaseSlot();
  }
}

/** Test seam — resets the process-wide gate between test cases. */
export function __resetRateLimiter(): void {
  inFlight = 0;
  waiters.length = 0;
}
