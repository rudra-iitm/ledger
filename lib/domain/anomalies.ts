import type { Expense, Subscription } from "./types";
import { resolveBrand } from "../brands/registry";
import { addDays, monthOf, parseISODate, previousMonth, todayISO } from "./dates";
import { formatMoney, roundMoney } from "./money";
import { isSpend } from "./transactions";

/**
 * Deterministic waste/anomaly detectors. Every alert carries a stable key
 * so dismissals stick, and enough detail to be verifiable — no black boxes.
 */

export interface FinanceAlert {
  key: string;
  severity: "info" | "warn";
  title: string;
  detail: string;
  expenseIds: string[];
}

export interface AnomalyInput {
  expenses: Expense[];
  subscriptions: Subscription[];
  currency: string;
  dismissed: string[];
}

function merchantKey(expense: Expense): string {
  const brand = resolveBrand(expense.description);
  if (brand) return brand.id;
  return expense.description
    .toLowerCase()
    .replace(/\d+/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hoursBetween(a: Expense, b: Expense): number {
  return (
    Math.abs(
      parseISODate(b.date).getTime() - parseISODate(a.date).getTime(),
    ) / 3_600_000
  );
}

/** Same merchant + same amount within 48h — likely a double charge. */
function duplicateCharges(
  spends: Expense[],
  currency: string,
  today: string,
): FinanceAlert[] {
  const recentCutoff = addDays(today, -14);
  const groups = new Map<string, Expense[]>();
  for (const row of spends) {
    if (row.date < recentCutoff) continue;
    const key = `${merchantKey(row)}|${row.amount.toFixed(2)}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  const alerts: FinanceAlert[] = [];
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < sorted.length; i += 1) {
      if (hoursBetween(sorted[i - 1], sorted[i]) <= 48) {
        alerts.push({
          key: `dup:${sorted[i].id}`,
          severity: "warn",
          title: `Possible double charge — ${sorted[i].description}`,
          detail: `${formatMoney(sorted[i].amount, currency)} was recorded twice within two days. If one is a duplicate, delete it.`,
          expenseIds: [sorted[i - 1].id, sorted[i].id],
        });
      }
    }
  }
  return alerts;
}

/** A tracked subscription charged noticeably more than its tracked price. */
function priceHikes(
  spends: Expense[],
  subscriptions: Subscription[],
  currency: string,
  today: string,
): FinanceAlert[] {
  const cutoff = addDays(today, -45);
  const alerts: FinanceAlert[] = [];
  for (const subscription of subscriptions) {
    if (!subscription.active) continue;
    const target = normalizeName(subscription.name);
    const match = spends
      .filter(
        (row) =>
          row.date >= cutoff &&
          (normalizeName(row.description).includes(target) ||
            resolveBrand(row.description)?.name === subscription.name),
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!match) continue;
    if (match.amount > subscription.amount * 1.02 + 0.01) {
      alerts.push({
        key: `hike:${subscription.id}:${match.amount.toFixed(2)}`,
        severity: "warn",
        title: `${subscription.name} price went up`,
        detail: `Charged ${formatMoney(match.amount, currency)} on ${match.date}, but it's tracked at ${formatMoney(subscription.amount, currency)}. Update the subscription if the new price is permanent.`,
        expenseIds: [match.id],
      });
    }
  }
  return alerts;
}

/** Current-month category spend far above its 3-month average. */
function categorySpikes(
  spends: Expense[],
  currency: string,
  today: string,
): FinanceAlert[] {
  const month = monthOf(today);
  const priorMonths = [0, 1, 2].reduce<string[]>(
    (list) => [...list, previousMonth(list[list.length - 1] ?? month)],
    [],
  );
  const totals = new Map<string, Map<string, number>>();
  for (const row of spends) {
    const rowMonth = monthOf(row.date);
    if (rowMonth !== month && !priorMonths.includes(rowMonth)) continue;
    const byMonth = totals.get(row.category) ?? new Map<string, number>();
    byMonth.set(rowMonth, roundMoney((byMonth.get(rowMonth) ?? 0) + row.amount));
    totals.set(row.category, byMonth);
  }
  const alerts: FinanceAlert[] = [];
  for (const [category, byMonth] of totals) {
    const current = byMonth.get(month) ?? 0;
    const prior = priorMonths
      .map((m) => byMonth.get(m) ?? 0)
      .filter((total) => total > 0);
    if (prior.length < 2) continue;
    const average = prior.reduce((sum, total) => sum + total, 0) / prior.length;
    if (average < 500) continue;
    if (current >= average * 1.75 && current - average >= 1000) {
      alerts.push({
        key: `spike:${category}:${month}`,
        severity: "info",
        title: `${category} is running hot this month`,
        detail: `${formatMoney(current, currency)} so far vs a ${formatMoney(roundMoney(average), currency)} average over the last ${prior.length} months (${Math.round((current / average) * 100)}%).`,
        expenseIds: [],
      });
    }
  }
  return alerts;
}

export function detectAnomalies(
  input: AnomalyInput,
  now: Date = new Date(),
): FinanceAlert[] {
  const today = todayISO(now);
  const spends = input.expenses.filter(isSpend);
  const dismissed = new Set(input.dismissed);
  return [
    ...duplicateCharges(spends, input.currency, today),
    ...priceHikes(spends, input.subscriptions, input.currency, today),
    ...categorySpikes(spends, input.currency, today),
  ]
    .filter((alert) => !dismissed.has(alert.key))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "warn" ? -1 : 1));
}
