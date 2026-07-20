/**
 * Local, inspectable AI activity log.
 *
 * The privacy contract in the README says every AI call is listed in Settings.
 * That is only credible if the log is written by the transport itself, so
 * there is no code path that reaches the network without landing here. It
 * lives in localStorage: never synced, never in backups.
 *
 * Prompt *content* is deliberately not stored — only its size, so the log
 * proves what was sent without becoming a second copy of the ledger.
 */

import { estimateCost, type ModelTier } from "./models";
import type { AiErrorKind } from "./provider";

const LOG_STORAGE = "ledger:ai-log";
const LOG_LIMIT = 100;

export interface AiLogEntry {
  at: string;
  feature: string;
  model: string;
  tier: ModelTier;
  promptChars: number;
  promptTokens: number;
  outputTokens: number;
  /** Estimated USD, from the local price table. */
  costUsd: number;
  latencyMs: number;
  cached: boolean;
  attempts: number;
  ok: boolean;
  errorKind?: AiErrorKind;
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeAiLog(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* a bad listener must not break logging */
    }
  }
}

export function readAiLog(): AiLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOG_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Entries written by the pre-v2 logger lack the newer fields; fill them in
    // so the Settings table never renders `undefined`.
    return parsed.map((entry) => normalise(entry as Partial<AiLogEntry>));
  } catch {
    return [];
  }
}

function normalise(entry: Partial<AiLogEntry>): AiLogEntry {
  return {
    at: entry.at ?? new Date(0).toISOString(),
    feature: entry.feature ?? "unknown",
    model: entry.model ?? "unknown",
    tier: entry.tier ?? "balanced",
    promptChars: entry.promptChars ?? 0,
    promptTokens: entry.promptTokens ?? 0,
    outputTokens: entry.outputTokens ?? 0,
    costUsd: entry.costUsd ?? 0,
    latencyMs: entry.latencyMs ?? 0,
    cached: entry.cached ?? false,
    attempts: entry.attempts ?? 1,
    ok: entry.ok ?? false,
    errorKind: entry.errorKind,
  };
}

export interface LogInput {
  feature: string;
  model: string;
  tier: ModelTier;
  promptChars: number;
  promptTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  cached?: boolean;
  attempts?: number;
  ok: boolean;
  errorKind?: AiErrorKind;
}

export function recordAiCall(input: LogInput): void {
  if (typeof window === "undefined") return;
  const promptTokens = input.promptTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const entry: AiLogEntry = {
    at: new Date().toISOString(),
    feature: input.feature,
    model: input.model,
    tier: input.tier,
    promptChars: input.promptChars,
    promptTokens,
    outputTokens,
    costUsd: input.cached ? 0 : estimateCost(input.model, promptTokens, outputTokens),
    latencyMs: input.latencyMs,
    cached: input.cached ?? false,
    attempts: input.attempts ?? 1,
    ok: input.ok,
    errorKind: input.errorKind,
  };
  try {
    const log = [entry, ...readAiLog()].slice(0, LOG_LIMIT);
    window.localStorage.setItem(LOG_STORAGE, JSON.stringify(log));
  } catch {
    /* logging must never break the feature */
  }
  emit();
}

export function clearAiLog(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOG_STORAGE);
  } catch {
    /* ignore */
  }
  emit();
}

export interface AiUsageSummary {
  calls: number;
  failures: number;
  cacheHits: number;
  promptTokens: number;
  outputTokens: number;
  costUsd: number;
  medianLatencyMs: number;
  byFeature: { feature: string; calls: number; costUsd: number }[];
}

/** Aggregate the log — pure over its input so it can be unit-tested. */
export function summariseAiLog(entries: AiLogEntry[]): AiUsageSummary {
  const latencies = entries
    .filter((entry) => !entry.cached && entry.ok)
    .map((entry) => entry.latencyMs)
    .sort((a, b) => a - b);

  const byFeature = new Map<string, { calls: number; costUsd: number }>();
  for (const entry of entries) {
    const current = byFeature.get(entry.feature) ?? { calls: 0, costUsd: 0 };
    current.calls += 1;
    current.costUsd += entry.costUsd;
    byFeature.set(entry.feature, current);
  }

  return {
    calls: entries.length,
    failures: entries.filter((entry) => !entry.ok).length,
    cacheHits: entries.filter((entry) => entry.cached).length,
    promptTokens: entries.reduce((sum, entry) => sum + entry.promptTokens, 0),
    outputTokens: entries.reduce((sum, entry) => sum + entry.outputTokens, 0),
    costUsd: entries.reduce((sum, entry) => sum + entry.costUsd, 0),
    medianLatencyMs: latencies.length
      ? latencies[Math.floor(latencies.length / 2)]
      : 0,
    byFeature: [...byFeature.entries()]
      .map(([feature, value]) => ({ feature, ...value }))
      .sort((a, b) => b.calls - a.calls),
  };
}
