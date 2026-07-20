/**
 * What the agent does while you aren't looking.
 *
 * A job is the unit of autonomous work: it knows whether it has anything to
 * do, what its inputs are, what it costs, and how to produce signals. It does
 * **not** know when it runs — that is `runtime.ts`'s decision, made against a
 * budget the job can't see. Keeping those apart is what makes it possible to
 * test "would this run?" without a network, a clock, or a model.
 *
 * Design rules for anything added here:
 *
 *  - **Fingerprint the inputs, not the time.** A job whose inputs haven't
 *    changed has nothing new to say, and re-running it spends the user's
 *    quota to print the same sentence.
 *  - **Degrade to silence.** A job that fails produces no signal. It never
 *    produces an error banner — the user did not ask for this work and should
 *    not be told it went wrong.
 *  - **Never write money.** Jobs may categorise, rank and describe. Creating,
 *    confirming or deleting a transaction stays a human decision.
 */

import { hashKey } from "../cache";
import { categorizeDrafts, needsCategorizing } from "../features/categorize";
import { buildBriefing, findInsights } from "../features/advisor";
import type { Suggestion } from "../features/categorize";
import { currentMonth, todayISO } from "@/lib/domain/dates";
import { monthExpenses } from "@/lib/domain/budget";
import type { LedgerData } from "@/lib/storage/repository";
import type { DraftSignal } from "./types";

/** The bridge back into the store. Jobs describe intent; the host applies it. */
export interface AgentActions {
  /** Write categories onto pending drafts. Returns how many landed. */
  applyCategorySuggestions(suggestions: Suggestion[]): number;
}

export interface JobContext {
  data: LedgerData;
  now: Date;
  signal?: AbortSignal;
  actions: AgentActions;
}

export interface JobOutcome {
  signals: DraftSignal[];
  /** One line for the activity log in Settings. */
  note?: string;
}

export interface AgentJob {
  id: string;
  /** Shown in Settings so the user can see what the agent is allowed to do. */
  label: string;
  description: string;
  /** Model calls one run costs. Charged against the daily autonomous budget. */
  cost: number;
  /** Seconds that must pass after a success before this may run again. */
  minIntervalSeconds: number;
  /** Is there anything to do right now? Cheap, synchronous, no network. */
  relevant(context: JobContext): boolean;
  /** Identity of the inputs. Unchanged fingerprint ⇒ no re-run. */
  fingerprint(context: JobContext): string;
  run(context: JobContext): Promise<JobOutcome>;
}

const HOUR = 3600;
const DAY = 24 * HOUR;

/* ------------------------------------------------------------------ */
/* Auto-categorisation                                                */
/* ------------------------------------------------------------------ */

/**
 * The highest-value thing the agent does.
 *
 * Imported rows that the brand registry, narration grammar and user rules all
 * failed to place would otherwise sit in the inbox as "Other" until the user
 * fixed them by hand. This closes that loop before they ever see the screen.
 *
 * It writes to *drafts*, never to confirmed expenses — the user still taps
 * confirm, they just no longer have to type a category first.
 */
export const categorizeJob: AgentJob = {
  id: "agent.categorize",
  label: "Categorise imports",
  description: "Names a category for imported rows the rules couldn't place.",
  cost: 1,
  // Short: this is reactive to an import, and an import is a burst.
  minIntervalSeconds: 5 * 60,
  relevant: ({ data }) => needsCategorizing(data.inbox.drafts).length > 0,
  fingerprint: ({ data }) =>
    hashKey(
      needsCategorizing(data.inbox.drafts)
        .map((draft) => draft.lineHash)
        .sort()
        .join("|"),
    ),
  async run({ data, actions, signal }) {
    const { suggestions, considered, unsure } = await categorizeDrafts({
      drafts: data.inbox.drafts,
      expenses: data.expenses,
      rules: data.rules,
      signal,
    });

    const applied = actions.applyCategorySuggestions(suggestions);
    if (applied === 0) {
      return { signals: [], note: `Categorise: nothing confident of ${considered}` };
    }

    return {
      note: `Categorise: ${applied} of ${considered} placed, ${unsure} unsure`,
      signals: [
        {
          id: `inbox:categorized:${todayISO()}`,
          kind: "inbox",
          severity: "info",
          title: `${applied} sorted for you`,
          body: `Imported rows that had no category now have one. Review before confirming.`,
          evidence: `${applied} of ${considered} placed; ${unsure} left as Other.`,
          href: "/inbox",
          source: "model",
          daysAway: 0,
          dismissible: true,
        },
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Daily brief                                                        */
/* ------------------------------------------------------------------ */

/**
 * One sentence at the top of the app.
 *
 * The old version of this was a button labelled "Brief me on today", which is
 * the product asking the user to ask it to do its job. It now runs itself,
 * once a day, and the result is cached against the date.
 */
export const briefJob: AgentJob = {
  id: "agent.brief",
  label: "Daily brief",
  description: "A sentence on what today looks like, refreshed once a day.",
  cost: 1,
  minIntervalSeconds: 12 * HOUR,
  relevant: ({ data }) => data.expenses.length > 0 || data.accounts.length > 0,
  fingerprint: ({ data, now }) =>
    hashKey(
      [
        todayISO(now),
        data.expenses.length,
        data.inbox.drafts.length,
        data.subscriptions.filter((item) => item.active).length,
      ].join(":"),
    ),
  async run({ data, now, signal }) {
    const text = await buildBriefing({ data, now, signal });
    const trimmed = text.trim();
    if (!trimmed) return { signals: [], note: "Brief: empty response" };

    return {
      note: "Brief: generated",
      signals: [
        {
          id: `brief:${todayISO(now)}`,
          kind: "brief",
          severity: "info",
          title: "Today",
          body: trimmed,
          source: "model",
          daysAway: 0,
          dismissible: true,
        },
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Insight scan                                                       */
/* ------------------------------------------------------------------ */

/**
 * The slow one: waste, drift and lifestyle inflation.
 *
 * Weekly rather than daily because the underlying signal moves on the scale
 * of weeks — running it every morning would spend four extra calls to print
 * the same three findings.
 *
 * Only findings the model marked high-confidence are promoted to signals.
 * A hedged observation is not worth a slot on the home screen.
 */
export const insightJob: AgentJob = {
  id: "agent.insights",
  label: "Weekly insight scan",
  description: "Looks for waste, drift and creeping costs across the month.",
  cost: 1,
  minIntervalSeconds: 7 * DAY,
  // Needs enough history to say anything that isn't noise.
  relevant: ({ data, now }) =>
    data.expenses.length >= 20 && monthExpenses(data.expenses, currentMonth(now)).length >= 5,
  fingerprint: ({ data, now }) =>
    hashKey(`${currentMonth(now)}:${data.expenses.length}:${data.subscriptions.length}`),
  async run({ data, now, signal }) {
    const { findings } = await findInsights({ data, now, signal });
    const strong = findings.filter((finding) => finding.confidence === "high").slice(0, 2);

    return {
      note: `Insights: ${findings.length} found, ${strong.length} confident`,
      signals: strong.map((finding) => ({
        id: `insight:${currentMonth(now)}:${hashKey(finding.title)}`,
        kind: "insight" as const,
        severity: "info" as const,
        title: finding.title,
        body: finding.detail,
        evidence: finding.evidence,
        href: "/analytics",
        source: "model" as const,
        daysAway: 0,
        dismissible: true,
      })),
    };
  },
};

/** Every job the runtime knows about, in the order it prefers to spend on. */
export const AGENT_JOBS: readonly AgentJob[] = [categorizeJob, briefJob, insightJob];
