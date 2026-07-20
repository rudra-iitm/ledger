/**
 * Computed signals — the agent's senses.
 *
 * Everything here is pure, synchronous and free. It runs on every render,
 * offline, with no API key and no network, and it produces the large majority
 * of what the user actually sees. That ordering is deliberate: the model is
 * an *enhancement* to this layer, never a dependency of it. Pull the Gemini
 * key out and Ledger still tells you that your balance goes negative on the
 * 14th — it just says it in our words instead of the model's.
 *
 * Each builder answers one question and returns at most one or two signals.
 * The cap matters more than the cleverness: a feed that shows nine things
 * shows nothing.
 */

import { detectAnomalies } from "@/lib/domain/anomalies";
import { budgetSummary, categoryBudgetSummaries } from "@/lib/domain/budget";
import { currentMonth, formatDisplayDate } from "@/lib/domain/dates";
import { projectCashFlow } from "@/lib/domain/forecast";
import { mineRecurring } from "@/lib/domain/ingest/recurrence";
import { formatMoney } from "@/lib/domain/money";
import { daysUntil, upcomingRenewals } from "@/lib/domain/subscriptions";
import type { LedgerData } from "@/lib/storage/repository";
import { rankSignals, type DraftSignal, type Signal } from "./types";

/* ------------------------------------------------------------------ */
/* Cash flow — the only thing that can actually hurt                   */
/* ------------------------------------------------------------------ */

function cashFlowSignals(data: LedgerData, now: Date): DraftSignal[] {
  const hasSchedules =
    data.recurring.some((item) => item.active) ||
    data.subscriptions.some((item) => item.active) ||
    data.recurringInvestments.some((item) => item.active);
  if (!hasSchedules) return [];

  const currency = data.settings.currency;
  const forecast = projectCashFlow(
    {
      recurring: data.recurring,
      subscriptions: data.subscriptions,
      recurringInvestments: data.recurringInvestments,
      accounts: data.accounts,
    },
    90,
    now,
  );

  if (forecast.firstNegative) {
    return [
      {
        // Keyed on the date, not the run: the same predicted overdraft keeps
        // its identity (and its dismissal) until the date itself moves.
        id: `cashflow:negative:${forecast.firstNegative.date}`,
        kind: "cashflow",
        severity: "critical",
        title: "Short before payday",
        body: `Your scheduled bills take you below zero on ${formatDisplayDate(
          forecast.firstNegative.date,
        )}.`,
        evidence: `Liquid now ${formatMoney(forecast.start, currency)}; projected ${formatMoney(
          forecast.firstNegative.balance,
          currency,
        )} on ${forecast.firstNegative.date}.`,
        href: "/calendar",
        source: "computed",
        daysAway: daysUntil(forecast.firstNegative.date, now),
        dismissible: false,
      },
    ];
  }

  // A low that is close to zero is worth saying even when it never crosses:
  // "you'll be fine" is only useful if we'd have told you otherwise.
  const thin = forecast.start > 0 && forecast.lowest.balance < forecast.start * 0.15;
  if (!thin) return [];

  return [
    {
      id: `cashflow:thin:${forecast.lowest.date}`,
      kind: "cashflow",
      severity: "warn",
      title: "Tight month ahead",
      body: `You stay positive, but only just — ${formatMoney(
        forecast.lowest.balance,
        currency,
      )} on ${formatDisplayDate(forecast.lowest.date)}.`,
      evidence: `Liquid now ${formatMoney(forecast.start, currency)}; low point ${formatMoney(
        forecast.lowest.balance,
        currency,
      )}.`,
      href: "/calendar",
      source: "computed",
      daysAway: daysUntil(forecast.lowest.date, now),
      dismissible: true,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Budget                                                             */
/* ------------------------------------------------------------------ */

function budgetSignals(data: LedgerData, now: Date): DraftSignal[] {
  const currency = data.settings.currency;
  const month = currentMonth(now);
  const signals: DraftSignal[] = [];

  const summary = budgetSummary(data.expenses, data.budgets.monthlyBudget, month);
  if (summary.budget > 0 && summary.overBudget) {
    signals.push({
      id: `budget:over:${month}`,
      kind: "budget",
      severity: "warn",
      title: "Over budget this month",
      body: `You're ${formatMoney(Math.abs(summary.remaining), currency)} past your ${formatMoney(
        summary.budget,
        currency,
      )} limit.`,
      evidence: `Spent ${formatMoney(summary.spent, currency)} of ${formatMoney(summary.budget, currency)}.`,
      href: "/analytics",
      source: "computed",
      daysAway: 0,
      dismissible: true,
    });
  }

  // Only the worst category. The dashboard already lists every breach; this
  // feed exists to say which one matters.
  const worst = categoryBudgetSummaries(data.expenses, data.budgets, month)
    .filter((item) => item.overBudget)
    .sort((a, b) => b.spent - b.budget - (a.spent - a.budget))[0];

  if (worst) {
    signals.push({
      id: `budget:category:${month}:${worst.category}`,
      kind: "budget",
      severity: "info",
      title: `${worst.category} over budget`,
      body: `${formatMoney(worst.spent, currency)} spent against a ${formatMoney(
        worst.budget,
        currency,
      )} cap.`,
      evidence: `${worst.category}: ${formatMoney(worst.spent, currency)} / ${formatMoney(worst.budget, currency)}.`,
      href: "/analytics",
      source: "computed",
      daysAway: 0,
      dismissible: true,
    });
  }

  return signals;
}

/* ------------------------------------------------------------------ */
/* Anomalies — double charges, price hikes, category spikes            */
/* ------------------------------------------------------------------ */

function anomalySignals(data: LedgerData, now: Date): DraftSignal[] {
  const alerts = detectAnomalies(
    {
      expenses: data.expenses,
      subscriptions: data.subscriptions,
      currency: data.settings.currency,
      dismissed: data.inbox.dismissedAlerts,
    },
    now,
  );

  return alerts.slice(0, 3).map((alert) => ({
    id: `anomaly:${alert.key}`,
    kind: "anomaly" as const,
    severity: alert.severity === "warn" ? ("warn" as const) : ("info" as const),
    title: alert.title,
    body: alert.detail,
    evidence: alert.detail,
    href: "/inbox",
    source: "computed" as const,
    daysAway: 0,
    dismissible: true,
  }));
}

/* ------------------------------------------------------------------ */
/* Renewals                                                           */
/* ------------------------------------------------------------------ */

function renewalSignals(data: LedgerData, now: Date): DraftSignal[] {
  const active = data.subscriptions.filter((item) => item.active);
  // Three days, not fourteen: a renewal you can still cancel is a signal, a
  // renewal two weeks out is a calendar entry.
  const soon = upcomingRenewals(active, 3, now);
  if (soon.length === 0) return [];

  const currency = data.settings.currency;
  const total = soon.reduce((sum, item) => sum + item.subscription.amount, 0);
  const first = soon[0];

  return [
    {
      id: `renewal:${first.subscription.id}:${first.subscription.nextRenewalDate}`,
      kind: "renewal",
      severity: "info",
      title: soon.length === 1 ? `${first.subscription.name} renews` : `${soon.length} renewals due`,
      body:
        soon.length === 1
          ? `${formatMoney(first.subscription.amount, currency)} in ${first.daysAway} day${
              first.daysAway === 1 ? "" : "s"
            }.`
          : `${formatMoney(total, currency)} across ${soon.length} subscriptions in the next 3 days.`,
      evidence: soon
        .map((item) => `${item.subscription.name} ${formatMoney(item.subscription.amount, currency)} (${item.daysAway}d)`)
        .join("; "),
      href: "/subscriptions",
      source: "computed",
      daysAway: first.daysAway,
      dismissible: true,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Inbox backlog                                                      */
/* ------------------------------------------------------------------ */

function inboxSignals(data: LedgerData): DraftSignal[] {
  const pending = data.inbox.drafts.filter((draft) => draft.status === "pending");
  if (pending.length === 0) return [];

  const needsDecision = pending.filter((draft) => draft.matchExpenseId).length;

  return [
    {
      // Bucketed, not exact: re-keying on every count change would resurrect
      // a dismissed signal the moment one more row landed.
      id: `inbox:pending:${pending.length > 20 ? "many" : "some"}`,
      kind: "inbox",
      severity: needsDecision > 0 ? "warn" : "info",
      title: `${pending.length} to confirm`,
      body:
        needsDecision > 0
          ? `${needsDecision} look like duplicates of rows you already have.`
          : "Imported transactions are categorised and waiting for a tap.",
      evidence: `${pending.length} pending draft${pending.length === 1 ? "" : "s"} in the inbox.`,
      href: "/inbox",
      source: "computed",
      daysAway: 0,
      dismissible: true,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Recurring payments the user hasn't told us about                   */
/* ------------------------------------------------------------------ */

/**
 * A subscription you're paying but haven't tracked is invisible money.
 *
 * `mineRecurring` was already doing this work — it was just buried on the
 * Inbox screen, which a user only opens after an import. Promoting the
 * strongest candidate to a signal is the difference between a feature that
 * exists and a feature that fires.
 *
 * Only the top candidate, and only ones seen at least three times: two
 * coincidences are not a subscription, and a list of maybes is worse than
 * silence.
 */
function recurringSignals(data: LedgerData, now: Date): DraftSignal[] {
  const suggestions = mineRecurring(
    data.expenses,
    {
      subscriptions: data.subscriptions,
      recurring: data.recurring,
      dismissed: data.inbox.dismissedSuggestions,
    },
    now,
  ).filter((item) => item.occurrences >= 3);

  const best = suggestions[0];
  if (!best) return [];

  const currency = data.settings.currency;
  const label = best.kind === "emi" ? "EMI" : best.kind === "bill" ? "bill" : "subscription";

  return [
    {
      id: `recurring:${best.key}`,
      kind: "recurring",
      severity: "info",
      title: `${best.merchant} looks recurring`,
      body: `${formatMoney(best.averageAmount, currency)} ${best.cadence}, ${
        best.occurrences
      } times so far. Track it as a ${label} and it'll show up in your forecast.`,
      evidence: `${best.occurrences} charges, last on ${best.lastDate}, next expected ${best.nextExpected}.`,
      href: "/inbox",
      source: "computed",
      daysAway: Math.max(0, daysUntil(best.nextExpected, now)),
      dismissible: true,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Assembly                                                           */
/* ------------------------------------------------------------------ */

export interface SignalContext {
  data: LedgerData;
  now?: Date;
  /** Signal ids the user has already dismissed. */
  dismissed?: readonly string[];
}

/**
 * Every computed signal, ranked, with dismissals applied.
 *
 * Cheap enough to call on each render — the underlying detectors are all
 * linear passes over arrays the store already holds in memory.
 */
export function buildComputedSignals(context: SignalContext): Signal[] {
  const now = context.now ?? new Date();
  const dismissed = new Set(context.dismissed ?? []);
  const drafts = [
    ...cashFlowSignals(context.data, now),
    ...budgetSignals(context.data, now),
    ...anomalySignals(context.data, now),
    ...renewalSignals(context.data, now),
    ...recurringSignals(context.data, now),
    ...inboxSignals(context.data),
  ].filter((signal) => !(signal.dismissible && dismissed.has(signal.id)));

  return rankSignals(drafts);
}
