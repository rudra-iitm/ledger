/**
 * The agent's memory of itself.
 *
 * A background process that spends the user's API quota has to be able to
 * answer three questions after a reload: what did I already do, what did it
 * cost, and what did I produce. Without persistence the agent re-runs every
 * job on every page load — which is exactly the "AI burns your quota in the
 * background" failure mode that makes people turn these features off.
 *
 * localStorage rather than the ledger repo, deliberately: run bookkeeping is
 * device-local telemetry, not user data. It must never end up in a backup, a
 * GitHub commit, or another device's view of the ledger.
 */

import type { Signal } from "./types";

const STORAGE_KEY = "ledger:agent-runs";
/** Bumped when the record shape changes; a mismatch resets rather than migrates. */
const VERSION = 1;

export interface JobRecord {
  /** Epoch ms of the last attempt, successful or not. */
  lastRunAt: number;
  /** Epoch ms of the last success. */
  lastOkAt: number;
  /**
   * Hash of the inputs the last successful run saw. A job whose inputs are
   * unchanged has nothing new to say, however long ago it ran.
   */
  inputHash: string;
  /** Consecutive failures — drives exponential backoff. */
  failures: number;
  /** Signals the job produced, replayed on load so the feed survives reloads. */
  signals: Signal[];
}

interface RunLedger {
  version: number;
  /** Local date (YYYY-MM-DD) the call counter belongs to. */
  day: string;
  /** Model calls the agent has made autonomously today. */
  spentToday: number;
  jobs: Record<string, JobRecord>;
}

const EMPTY: RunLedger = { version: VERSION, day: "", spentToday: 0, jobs: {} };

function read(): RunLedger {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as RunLedger;
    if (!parsed || parsed.version !== VERSION) return { ...EMPTY };
    return { ...EMPTY, ...parsed, jobs: parsed.jobs ?? {} };
  } catch {
    return { ...EMPTY };
  }
}

function write(ledger: RunLedger): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    // A full quota must not take the agent — or the app — down with it.
  }
}

function localDay(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

/** Roll the daily counter over at local midnight. */
function rolled(ledger: RunLedger, now: Date): RunLedger {
  const day = localDay(now);
  return ledger.day === day ? ledger : { ...ledger, day, spentToday: 0 };
}

export function jobRecord(jobId: string): JobRecord | undefined {
  return read().jobs[jobId];
}

export function allSignals(): Signal[] {
  const ledger = read();
  return Object.values(ledger.jobs).flatMap((record) => record.signals ?? []);
}

export function spentToday(now: Date = new Date()): number {
  return rolled(read(), now).spentToday;
}

/** Called once per autonomous model call, before the call is made. */
export function noteAgentSpend(now: Date = new Date()): void {
  const ledger = rolled(read(), now);
  write({ ...ledger, spentToday: ledger.spentToday + 1 });
}

export function recordSuccess(
  jobId: string,
  inputHash: string,
  signals: Signal[],
  now: Date = new Date(),
): void {
  const ledger = rolled(read(), now);
  const at = now.getTime();
  write({
    ...ledger,
    jobs: {
      ...ledger.jobs,
      [jobId]: { lastRunAt: at, lastOkAt: at, inputHash, failures: 0, signals },
    },
  });
}

export function recordFailure(jobId: string, now: Date = new Date()): void {
  const ledger = rolled(read(), now);
  const previous = ledger.jobs[jobId];
  write({
    ...ledger,
    jobs: {
      ...ledger.jobs,
      [jobId]: {
        lastRunAt: now.getTime(),
        lastOkAt: previous?.lastOkAt ?? 0,
        inputHash: previous?.inputHash ?? "",
        failures: (previous?.failures ?? 0) + 1,
        // Keep the last good signals: a failed refresh should not blank the
        // feed the user was already looking at.
        signals: previous?.signals ?? [],
      },
    },
  });
}

/** Drop one job's stored signals — used when the user dismisses its output. */
export function forgetSignal(signalId: string): void {
  const ledger = read();
  const jobs: Record<string, JobRecord> = {};
  for (const [id, record] of Object.entries(ledger.jobs)) {
    jobs[id] = { ...record, signals: (record.signals ?? []).filter((s) => s.id !== signalId) };
  }
  write({ ...ledger, jobs });
}

export function resetRunLedger(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}
