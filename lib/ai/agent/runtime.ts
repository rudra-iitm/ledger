/**
 * The scheduler.
 *
 * This module answers one question — *may this job run right now?* — and then
 * runs the ones that may, one at a time, on idle. Everything about it is
 * built around the fact that autonomous AI spends someone else's money:
 *
 *  - **A hard daily ceiling.** Not a guideline. When the budget is gone the
 *    agent stops until local midnight, and the computed signal layer carries
 *    the app on its own.
 *  - **Serial, never parallel.** Two jobs firing together doubles the odds of
 *    tripping a rate limit, and the user is not waiting on any of this.
 *  - **Idle, never blocking.** Scheduling happens in `requestIdleCallback`
 *    so the agent can never make a tap feel slow.
 *  - **Exponential backoff on failure.** A revoked API key should cost three
 *    failed calls, not one per page load forever.
 *
 * `dueNow` is exported and pure so the policy can be tested without a clock,
 * a network or a model.
 */

import { aiReady } from "../client";
import { AGENT_JOBS, type AgentActions, type AgentJob, type JobContext } from "./jobs";
import {
  jobRecord,
  noteAgentSpend,
  recordFailure,
  recordSuccess,
  spentToday,
  type JobRecord,
} from "./run-ledger";
import { rankSignals, type Signal } from "./types";

/**
 * Model calls the agent may make on its own in a day.
 *
 * Six is chosen against the job set, not plucked: one categorise burst per
 * import, one brief, one weekly scan, and headroom for a retry. A user who
 * wants more can still trigger anything by hand — this caps only what runs
 * without being asked.
 */
export const DAILY_AGENT_BUDGET = 6;

const BASE_BACKOFF_MS = 5 * 60 * 1000;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;

/** Failure backoff: 5m, 10m, 20m … capped at 6h. */
export function backoffMs(failures: number): number {
  if (failures <= 0) return 0;
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (failures - 1));
}

export interface DuePolicy {
  record: JobRecord | undefined;
  fingerprint: string;
  now: Date;
}

/**
 * Whether a job is due.
 *
 * Order matters: backoff is checked before staleness so a failing job can't
 * be dragged back in by a fingerprint change, and the fingerprint is checked
 * before the interval so unchanged inputs never spend, however old the run.
 */
export function dueNow(job: AgentJob, policy: DuePolicy): boolean {
  const { record, fingerprint, now } = policy;
  if (!record) return true;

  const since = now.getTime() - record.lastRunAt;
  if (record.failures > 0) return since >= backoffMs(record.failures);
  if (record.inputHash === fingerprint) return false;
  return now.getTime() - record.lastOkAt >= job.minIntervalSeconds * 1000;
}

export interface RuntimeOptions {
  data: JobContext["data"];
  actions: AgentActions;
  now?: Date;
  signal?: AbortSignal;
  /** Off by default at the call site — the host decides, not this module. */
  enabled: boolean;
  jobs?: readonly AgentJob[];
  /** Called after each job that produced anything, so the UI can update. */
  onSignals?: (signals: Signal[]) => void;
  /** One line per run, for the activity log. */
  onNote?: (note: string) => void;
}

export interface RuntimeResult {
  ran: string[];
  skipped: string[];
  signals: Signal[];
  /** Set when the agent stopped for a reason worth naming in Settings. */
  haltedBecause?: "disabled" | "no-key" | "offline" | "budget";
}

/**
 * Run one pass over the job set.
 *
 * Returns rather than throws: a background process that raises into the app's
 * error boundary because a subscription lookup 502'd is a worse bug than the
 * one it was reporting.
 */
export async function runAgentPass(options: RuntimeOptions): Promise<RuntimeResult> {
  const now = options.now ?? new Date();
  const jobs = options.jobs ?? AGENT_JOBS;
  const result: RuntimeResult = { ran: [], skipped: [], signals: [] };

  if (!options.enabled) return { ...result, haltedBecause: "disabled" };
  if (!aiReady()) return { ...result, haltedBecause: "no-key" };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ...result, haltedBecause: "offline" };
  }

  const context: JobContext = {
    data: options.data,
    now,
    signal: options.signal,
    actions: options.actions,
  };

  for (const job of jobs) {
    if (options.signal?.aborted) break;

    if (spentToday(now) + job.cost > DAILY_AGENT_BUDGET) {
      result.haltedBecause = "budget";
      result.skipped.push(job.id);
      continue;
    }
    if (!job.relevant(context)) {
      result.skipped.push(job.id);
      continue;
    }

    const fingerprint = job.fingerprint(context);
    if (!dueNow(job, { record: jobRecord(job.id), fingerprint, now })) {
      result.skipped.push(job.id);
      continue;
    }

    try {
      // Charged before the call, not after: a call that fails after leaving
      // the device has still been billed by Google.
      if (job.cost > 0) noteAgentSpend(now);
      const outcome = await job.run(context);
      const ranked = rankSignals(outcome.signals);
      recordSuccess(job.id, fingerprint, ranked, now);
      result.ran.push(job.id);
      result.signals.push(...ranked);
      if (outcome.note) options.onNote?.(outcome.note);
      if (ranked.length) options.onSignals?.(ranked);
    } catch {
      // Silent by design. The user did not ask for this run, so a failure is
      // ours to retry, not theirs to read about.
      recordFailure(job.id, now);
      result.skipped.push(job.id);
    }
  }

  return result;
}

/** Schedule a pass for the next idle moment. Returns a cancel function. */
export function scheduleAgentPass(run: () => void, timeoutMs = 4000): () => void {
  if (typeof window === "undefined") return () => {};

  const idle = (window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  }).requestIdleCallback;

  if (!idle) {
    // Safari has shipped requestIdleCallback since 16.4, but the PWA targets
    // older iOS too — a timeout is a fine stand-in for "not right now".
    const timer = window.setTimeout(run, timeoutMs);
    return () => window.clearTimeout(timer);
  }

  const handle = idle(run, { timeout: timeoutMs });
  return () => {
    (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
  };
}

export { DAILY_AGENT_BUDGET as AGENT_BUDGET };
