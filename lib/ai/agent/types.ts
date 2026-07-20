/**
 * The agent's vocabulary.
 *
 * Ledger's intelligence is not a chat window and not a dashboard — it is a
 * stream of **signals**: small, ranked, dismissable statements about the
 * user's money that appear where they are relevant and disappear once they
 * stop being true.
 *
 * Two invariants hold for every signal in the system:
 *
 *  1. **Every signal is actionable.** If there is nothing the user could do
 *     or would change their mind about, it is a statistic, not a signal, and
 *     it belongs on the analytics screen instead.
 *  2. **Every number is computed.** `source: "computed"` signals are produced
 *     entirely by `lib/domain`. `source: "model"` signals may have
 *     model-authored *prose*, but the figures inside them are still passed in
 *     from the domain layer — the model ranks and phrases, it never counts.
 */

/** Where a signal came from, and therefore how much to trust its wording. */
export type SignalSource = "computed" | "model";

export type SignalKind =
  | "cashflow"
  | "budget"
  | "anomaly"
  | "renewal"
  | "inbox"
  | "recurring"
  | "insight"
  | "brief";

/**
 * Ordering, not decoration.
 *
 * `critical` means money is at risk on a known date. `warn` means a threshold
 * has been crossed. `info` is everything the user would still want to know.
 */
export type SignalSeverity = "critical" | "warn" | "info";

export const SEVERITY_WEIGHT: Record<SignalSeverity, number> = {
  critical: 1000,
  warn: 500,
  info: 100,
};

export interface Signal {
  /**
   * Stable across runs for the same underlying fact — dismissals key off it,
   * so a regenerated signal about the same overdraft must reuse the same id.
   */
  id: string;
  kind: SignalKind;
  severity: SignalSeverity;
  /** Six words or fewer. Rendered as the headline. */
  title: string;
  /** One or two sentences. */
  body: string;
  /** The figures this rests on, so the user can check our work. */
  evidence?: string;
  /** Where tapping the signal goes. */
  href?: string;
  source: SignalSource;
  /** Computed by `rankSignals`; higher sorts first. */
  score: number;
  /**
   * How many days out the thing it describes is. Drives urgency within a
   * severity band — a negative balance in three days outranks one in sixty.
   */
  daysAway?: number;
  dismissible: boolean;
}

/** A signal before ranking. `score` is the runtime's job, not the builder's. */
export type DraftSignal = Omit<Signal, "score">;

/**
 * Rank signals for display.
 *
 * Severity dominates; nearness breaks ties within a band; the kind order is
 * the final tiebreak so the list is stable across renders rather than
 * shuffling on every recompute.
 */
export function rankSignals(drafts: DraftSignal[]): Signal[] {
  return drafts
    .map((draft) => {
      const urgency =
        draft.daysAway === undefined
          ? 0
          : // 0 days away → +90, 90 days away → +0. Clamped so a far-future
            // event never scores negative and outranks nothing.
            Math.max(0, 90 - Math.min(90, Math.max(0, draft.daysAway)));
      return { ...draft, score: SEVERITY_WEIGHT[draft.severity] + urgency };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
