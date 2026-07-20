/**
 * Model routing.
 *
 * Features ask for a *capability tier*, never a model name. That keeps the
 * feature code stable while the model landscape churns underneath it, and it
 * lets one edit here re-price the whole app.
 *
 * Each tier is a *chain*, not a single id: if a model is unknown to the API
 * (Google retires ids on its own schedule) the client walks to the next one
 * and remembers the winner, so a stale id degrades into a slower first call
 * instead of a dead feature.
 */

export const MODEL_TIERS = ["fast", "balanced", "deep", "vision"] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

export interface ModelSpec {
  id: string;
  /** USD per 1M tokens — used only for the local cost estimate in Settings. */
  inputPer1M: number;
  outputPer1M: number;
}

/**
 * Ordered preference per tier. First entry is the intent; the rest are
 * fallbacks that keep the feature alive if the intent is retired.
 *
 * The `-latest` aliases lead every chain deliberately. Pinned ids rot: this
 * app is bring-your-own-key, so a model Google retires for *new* accounts
 * silently breaks AI for exactly the users who just signed up — which is how
 * `gemini-2.5-flash` failed here before. The alias tracks Google's current
 * model of that class, and the pinned ids behind it are the safety net for
 * the day an alias is the thing that disappears.
 *
 * The safety net only works if it is alive. Verified against the live API on
 * 20 Jul 2026: `gemini-2.5-flash` now answers
 *   404 "no longer available to new users"
 * so it was a dead fallback sitting in two chains, costing a wasted probe per
 * new user and protecting nobody. Replaced with `gemini-3.5-flash`, which
 * answered 503 (busy — i.e. it exists and serves this account). Re-check these
 * pins when a Gemini generation ships; a fallback nobody has called in a year
 * is a guess, not a net.
 */
export const MODEL_CHAINS: Record<ModelTier, ModelSpec[]> = {
  /** High-volume, low-stakes classification: categorization, merchant naming. */
  fast: [
    { id: "gemini-flash-lite-latest", inputPer1M: 0.1, outputPer1M: 0.4 },
    { id: "gemini-2.5-flash-lite", inputPer1M: 0.1, outputPer1M: 0.4 },
    { id: "gemini-flash-latest", inputPer1M: 0.3, outputPer1M: 2.5 },
  ],
  /** Everyday reasoning: query compilation, narration, the daily brief. */
  balanced: [
    { id: "gemini-flash-latest", inputPer1M: 0.3, outputPer1M: 2.5 },
    { id: "gemini-3.5-flash", inputPer1M: 0.3, outputPer1M: 2.5 },
    { id: "gemini-flash-lite-latest", inputPer1M: 0.1, outputPer1M: 0.4 },
  ],
  /** Multi-step advice where being wrong is expensive: goals, tax, portfolio. */
  deep: [
    { id: "gemini-pro-latest", inputPer1M: 1.25, outputPer1M: 10 },
    { id: "gemini-3-pro-preview", inputPer1M: 1.25, outputPer1M: 10 },
    { id: "gemini-flash-latest", inputPer1M: 0.3, outputPer1M: 2.5 },
  ],
  /** Documents: receipts, invoices, payslips, statement scans. */
  vision: [
    { id: "gemini-flash-latest", inputPer1M: 0.3, outputPer1M: 2.5 },
    { id: "gemini-3.5-flash", inputPer1M: 0.3, outputPer1M: 2.5 },
    { id: "gemini-pro-latest", inputPer1M: 1.25, outputPer1M: 10 },
  ],
};

export const TIER_LABELS: Record<ModelTier, string> = {
  fast: "Fast",
  balanced: "Balanced",
  deep: "Deep reasoning",
  vision: "Document vision",
};

const RESOLVED_STORAGE = "ledger:ai-resolved-models";

type ResolvedMap = Partial<Record<ModelTier, string>>;

function readResolved(): ResolvedMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RESOLVED_STORAGE);
    return raw ? (JSON.parse(raw) as ResolvedMap) : {};
  } catch {
    return {};
  }
}

/**
 * The chain for a tier, with any previously-proven model hoisted to the front
 * so steady-state traffic never pays for a retired-model probe.
 */
export function chainFor(tier: ModelTier): ModelSpec[] {
  const chain = MODEL_CHAINS[tier];
  const proven = readResolved()[tier];
  if (!proven) return chain;
  const hit = chain.find((spec) => spec.id === proven);
  if (!hit) return chain;
  return [hit, ...chain.filter((spec) => spec.id !== proven)];
}

/** Remember that `modelId` answered for `tier`, so it is tried first next time. */
export function rememberResolved(tier: ModelTier, modelId: string): void {
  if (typeof window === "undefined") return;
  try {
    const next = { ...readResolved(), [tier]: modelId };
    window.localStorage.setItem(RESOLVED_STORAGE, JSON.stringify(next));
  } catch {
    /* a cache that can't be written is still a working app */
  }
}

/** Forget every proven model — used when the user changes keys or projects. */
export function clearResolved(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(RESOLVED_STORAGE);
  } catch {
    /* ignore */
  }
}

export function specFor(modelId: string): ModelSpec | null {
  for (const chain of Object.values(MODEL_CHAINS)) {
    const hit = chain.find((spec) => spec.id === modelId);
    if (hit) return hit;
  }
  return null;
}

/** Rough USD cost of one call — shown in the activity log, never billed on. */
export function estimateCost(
  modelId: string,
  promptTokens: number,
  outputTokens: number,
): number {
  const spec = specFor(modelId);
  if (!spec) return 0;
  return (
    (promptTokens / 1_000_000) * spec.inputPer1M +
    (outputTokens / 1_000_000) * spec.outputPer1M
  );
}
