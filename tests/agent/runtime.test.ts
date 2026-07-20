import { describe, expect, it } from "vitest";
import { backoffMs, dueNow } from "@/lib/ai/agent/runtime";
import type { AgentJob } from "@/lib/ai/agent/jobs";
import type { JobRecord } from "@/lib/ai/agent/run-ledger";
import { rankSignals, type DraftSignal } from "@/lib/ai/agent/types";

const HOUR = 3600;

const job: AgentJob = {
  id: "test.job",
  label: "Test",
  description: "",
  cost: 1,
  minIntervalSeconds: 12 * HOUR,
  relevant: () => true,
  fingerprint: () => "abc",
  run: async () => ({ signals: [] }),
};

function record(patch: Partial<JobRecord> = {}): JobRecord {
  return { lastRunAt: 0, lastOkAt: 0, inputHash: "abc", failures: 0, signals: [], ...patch };
}

const NOW = new Date("2026-07-20T12:00:00Z");
const ago = (ms: number) => NOW.getTime() - ms;

describe("dueNow", () => {
  it("runs a job that has never run", () => {
    expect(dueNow(job, { record: undefined, fingerprint: "abc", now: NOW })).toBe(true);
  });

  it("does not re-run when the inputs are unchanged, however old the run", () => {
    const stale = record({ lastOkAt: ago(30 * 24 * HOUR * 1000), lastRunAt: ago(30 * 24 * HOUR * 1000) });
    expect(dueNow(job, { record: stale, fingerprint: "abc", now: NOW })).toBe(false);
  });

  it("runs when the inputs changed and the interval has elapsed", () => {
    const old = record({ lastOkAt: ago(13 * HOUR * 1000), lastRunAt: ago(13 * HOUR * 1000) });
    expect(dueNow(job, { record: old, fingerprint: "different", now: NOW })).toBe(true);
  });

  it("holds off when the inputs changed but the interval has not elapsed", () => {
    const recent = record({ lastOkAt: ago(HOUR * 1000), lastRunAt: ago(HOUR * 1000) });
    expect(dueNow(job, { record: recent, fingerprint: "different", now: NOW })).toBe(false);
  });

  it("backs off after a failure, then retries once the window passes", () => {
    const justFailed = record({ failures: 1, lastRunAt: ago(60 * 1000) });
    expect(dueNow(job, { record: justFailed, fingerprint: "abc", now: NOW })).toBe(false);

    const cooled = record({ failures: 1, lastRunAt: ago(6 * 60 * 1000) });
    expect(dueNow(job, { record: cooled, fingerprint: "abc", now: NOW })).toBe(true);
  });

  it("backs off further with each consecutive failure", () => {
    // A revoked key must cost a handful of calls, not one per page load.
    expect(backoffMs(1)).toBe(5 * 60 * 1000);
    expect(backoffMs(2)).toBe(10 * 60 * 1000);
    expect(backoffMs(3)).toBe(20 * 60 * 1000);
    expect(backoffMs(20)).toBe(6 * 60 * 60 * 1000);
    expect(backoffMs(0)).toBe(0);
  });

  it("lets backoff win over a fingerprint change", () => {
    // Otherwise a job that fails on every import would retry on every import.
    const failing = record({ failures: 3, lastRunAt: ago(60 * 1000) });
    expect(dueNow(job, { record: failing, fingerprint: "changed", now: NOW })).toBe(false);
  });
});

describe("rankSignals", () => {
  const draft = (patch: Partial<DraftSignal>): DraftSignal => ({
    id: "x",
    kind: "insight",
    severity: "info",
    title: "t",
    body: "b",
    source: "computed",
    dismissible: true,
    ...patch,
  });

  it("puts severity ahead of nearness", () => {
    const ranked = rankSignals([
      draft({ id: "soon-info", severity: "info", daysAway: 0 }),
      draft({ id: "far-critical", severity: "critical", daysAway: 80 }),
    ]);
    expect(ranked[0].id).toBe("far-critical");
  });

  it("breaks ties within a severity band by nearness", () => {
    const ranked = rankSignals([
      draft({ id: "later", severity: "warn", daysAway: 40 }),
      draft({ id: "sooner", severity: "warn", daysAway: 2 }),
    ]);
    expect(ranked.map((s) => s.id)).toEqual(["sooner", "later"]);
  });

  it("is stable for signals that tie completely", () => {
    const ranked = rankSignals([draft({ id: "b" }), draft({ id: "a" })]);
    expect(ranked.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("never scores a far-future signal below a scoreless one", () => {
    const ranked = rankSignals([
      draft({ id: "no-date", severity: "info" }),
      draft({ id: "far", severity: "info", daysAway: 900 }),
    ]);
    expect(ranked.every((signal) => signal.score >= 100)).toBe(true);
  });
});
