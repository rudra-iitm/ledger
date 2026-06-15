import type { Expense, RecurringInvestment } from "./types";
import {
  addDays,
  addMonthsClamped,
  addYears,
  clampedDateInMonth,
  monthOf,
  todayISO,
} from "./dates";
import { createId } from "./id";

export interface InvestmentMaterializationResult {
  newExpenses: Expense[];
  updatedRecurring: RecurringInvestment[];
  changed: boolean;
}

function firstOccurrence(item: RecurringInvestment): string {
  switch (item.frequency) {
    case "monthly":
    case "quarterly": {
      const candidate = clampedDateInMonth(
        monthOf(item.startDate),
        item.dayOfMonth,
      );
      const step = item.frequency === "quarterly" ? 3 : 1;
      return candidate >= item.startDate
        ? candidate
        : addMonthsClamped(candidate, step, item.dayOfMonth);
    }
    case "yearly":
    case "weekly":
    case "daily":
    default:
      return item.startDate;
  }
}

function advance(item: RecurringInvestment, date: string): string {
  switch (item.frequency) {
    case "daily":
      return addDays(date, 1);
    case "weekly":
      return addDays(date, 7);
    case "monthly":
      return addMonthsClamped(date, 1, item.dayOfMonth);
    case "quarterly":
      return addMonthsClamped(date, 3, item.dayOfMonth);
    case "yearly":
      return addYears(date, 1);
    default:
      return addMonthsClamped(date, 1, item.dayOfMonth);
  }
}

function occurrences(item: RecurringInvestment, today: string): string[] {
  const result: string[] = [];
  let date = item.lastMaterializedDate
    ? advance(item, item.lastMaterializedDate)
    : firstOccurrence(item);
  let guard = 0;
  while (date <= today && guard < 10_000) {
    result.push(date);
    date = advance(item, date);
    guard += 1;
  }
  return result;
}

export function materializeInvestments(
  recurring: RecurringInvestment[],
  now: Date = new Date(),
): InvestmentMaterializationResult {
  const today = todayISO(now);
  const newExpenses: Expense[] = [];
  let changed = false;

  const updatedRecurring = recurring.map((item) => {
    if (!item.active) return item;
    const dueDates = occurrences(item, today);
    if (dueDates.length === 0) return item;

    for (const date of dueDates) {
      newExpenses.push({
        id: createId(),
        description: item.name,
        amount: item.amount,
        type: "investment" as const,
        category: "Investments",
        date,
        createdAt: now.toISOString(),
        accountId: item.fromAccountId,
        transferAccountId: item.investmentAccountId,
        units: item.units,
        affectsBalance: item.affectsBalance ?? true,
        notes: item.notes,
        tags: [],
        attachments: [],
      });
    }
    changed = true;
    return { ...item, lastMaterializedDate: dueDates[dueDates.length - 1] };
  });

  return { newExpenses, updatedRecurring, changed };
}

export function nextInvestmentDate(
  item: RecurringInvestment,
  now: Date = new Date(),
): string {
  const today = todayISO(now);
  let date = item.lastMaterializedDate
    ? advance(item, item.lastMaterializedDate)
    : firstOccurrence(item);
  let guard = 0;
  while (date < today && guard < 10_000) {
    date = advance(item, date);
    guard += 1;
  }
  return date;
}
