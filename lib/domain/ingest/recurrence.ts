import type {
  BillingCycle,
  Category,
  Expense,
  RecurringExpense,
  Subscription,
} from "../types";
import { resolveBrand } from "../../brands/registry";
import { addDays, addMonthsClamped, parseISODate, todayISO } from "../dates";
import { roundMoney } from "../money";
import { isSpend } from "../transactions";

export interface RecurringSuggestion {
  /** Stable identity used for dismissal: merchantKey|cadence */
  key: string;
  merchant: string;
  cadence: BillingCycle;
  averageAmount: number;
  /** Every occurrence had the identical amount — subscription-like. */
  amountStable: boolean;
  occurrences: number;
  lastDate: string;
  nextExpected: string;
  accountId?: string;
  category: Category;
  kind: "subscription" | "emi" | "bill";
  expenseIds: string[];
}

const LOOKBACK_DAYS = 420;
const MIN_OCCURRENCES = 3;

interface CadenceSpec {
  cadence: BillingCycle;
  min: number;
  max: number;
  step: number;
}

const CADENCES: CadenceSpec[] = [
  { cadence: "weekly", min: 5, max: 9, step: 7 },
  { cadence: "monthly", min: 26, max: 35, step: 30 },
  { cadence: "quarterly", min: 80, max: 100, step: 91 },
  { cadence: "yearly", min: 350, max: 380, step: 365 },
];

function merchantKey(expense: Expense): string {
  const brand = resolveBrand(expense.description);
  if (brand) return `brand:${brand.id}`;
  const normalized = expense.description
    .toLowerCase()
    .replace(/\d+/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized ? `text:${normalized}` : "";
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function gapDays(a: string, b: string): number {
  return Math.round(
    (parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000,
  );
}

function fitCadence(dates: string[]): CadenceSpec | null {
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i += 1) {
    gaps.push(gapDays(dates[i - 1], dates[i]));
  }
  for (const spec of CADENCES) {
    const within = gaps.filter(
      (gap) => gap >= spec.min && gap <= spec.max,
    ).length;
    if (within >= Math.max(2, Math.ceil(gaps.length * 0.75))) return spec;
  }
  return null;
}

/**
 * Mines untracked spend history for repeating merchant payments.
 * Suggestions already covered by a subscription or recurring template
 * (matched by name) or previously dismissed are excluded.
 */
export function mineRecurring(
  expenses: Expense[],
  existing: {
    subscriptions: Subscription[];
    recurring: RecurringExpense[];
    dismissed: string[];
  },
  now: Date = new Date(),
): RecurringSuggestion[] {
  const today = todayISO(now);
  const cutoff = addDays(today, -LOOKBACK_DAYS);
  const trackedNames = new Set([
    ...existing.subscriptions.map((item) => normalizeName(item.name)),
    ...existing.recurring.map((item) => normalizeName(item.description)),
  ]);
  const dismissed = new Set(existing.dismissed);

  const groups = new Map<string, Expense[]>();
  for (const expense of expenses) {
    if (!isSpend(expense)) continue;
    if (expense.recurringId || expense.subscriptionId) continue;
    if (expense.date < cutoff) continue;
    const key = merchantKey(expense);
    if (!key) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(expense);
    else groups.set(key, [expense]);
  }

  const suggestions: RecurringSuggestion[] = [];
  for (const [key, rows] of groups) {
    if (rows.length < MIN_OCCURRENCES) continue;
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const spec = fitCadence(sorted.map((row) => row.date));
    if (!spec) continue;

    const amounts = sorted.map((row) => row.amount);
    const average = roundMoney(
      amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length,
    );
    const amountStable = amounts.every(
      (amount) => Math.abs(amount - amounts[0]) < 0.005,
    );
    // Variable amounts beyond ±25% of the average look like ordinary
    // repeat shopping, not a bill.
    if (
      !amountStable &&
      amounts.some((amount) => Math.abs(amount - average) > average * 0.25)
    ) {
      continue;
    }

    const last = sorted[sorted.length - 1];
    const merchant =
      resolveBrand(last.description)?.name ?? last.description;
    if (trackedNames.has(normalizeName(merchant))) continue;

    const suggestionKey = `${key}|${spec.cadence}`;
    if (dismissed.has(suggestionKey)) continue;

    const isEmi = /\b(emi|loan|instal?lment)\b/i.test(
      sorted.map((row) => row.description).join(" "),
    );
    // Months step on the day-of-month anchor (Jul 10 → Aug 10, not Aug 9).
    const anchorDay = Number(last.date.slice(8, 10));
    const monthsPerStep =
      spec.cadence === "monthly" ? 1 : spec.cadence === "quarterly" ? 3 : 12;
    const step = (date: string): string =>
      spec.cadence === "weekly"
        ? addDays(date, 7)
        : addMonthsClamped(date, monthsPerStep, anchorDay);
    let nextExpected = step(last.date);
    while (nextExpected < today) nextExpected = step(nextExpected);

    suggestions.push({
      key: suggestionKey,
      merchant,
      cadence: spec.cadence,
      averageAmount: average,
      amountStable,
      occurrences: sorted.length,
      lastDate: last.date,
      nextExpected,
      accountId: last.accountId,
      category: last.category,
      kind: isEmi ? "emi" : amountStable ? "subscription" : "bill",
      expenseIds: sorted.map((row) => row.id),
    });
  }

  return suggestions.sort((a, b) => b.occurrences - a.occurrences);
}

/** Stable-amount suggestions become Subscriptions. */
export function suggestionToSubscription(
  suggestion: RecurringSuggestion,
): Omit<Subscription, "id" | "createdAt"> {
  return {
    name: suggestion.merchant,
    amount: suggestion.averageAmount,
    billingCycle: suggestion.cadence,
    category: suggestion.category,
    nextRenewalDate: suggestion.nextExpected,
    accountId: suggestion.accountId,
    active: true,
  };
}

/** Variable bills / EMIs become recurring templates (no quarterly there). */
export function suggestionTarget(
  suggestion: RecurringSuggestion,
): "subscription" | "recurring" {
  if (suggestion.kind === "subscription") return "subscription";
  return suggestion.cadence === "quarterly" ? "subscription" : "recurring";
}

export function suggestionToRecurring(
  suggestion: RecurringSuggestion,
): Omit<RecurringExpense, "id" | "createdAt" | "lastMaterializedDate"> {
  const dayOfMonth = Number(suggestion.nextExpected.slice(8, 10));
  return {
    description: suggestion.merchant,
    amount: suggestion.averageAmount,
    category: suggestion.category,
    kind: "expense",
    frequency: suggestion.cadence === "weekly" ? "weekly" : suggestion.cadence === "yearly" ? "yearly" : "monthly",
    dayOfMonth: Math.min(dayOfMonth, 31),
    startDate: suggestion.nextExpected,
    accountId: suggestion.accountId,
    active: true,
  };
}
