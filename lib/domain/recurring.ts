import type { Expense, RecurringExpense } from "./types";
import {
  addDays,
  addMonthsClamped,
  addYears,
  clampedDateInMonth,
  monthOf,
  todayISO,
} from "./dates";
import { createId } from "./id";

export interface MaterializationResult {
  newExpenses: Expense[];
  updatedRecurring: RecurringExpense[];
  changed: boolean;
}

function firstOccurrence(item: RecurringExpense): string {
  switch (item.frequency) {
    case "monthly": {
      const candidate = clampedDateInMonth(monthOf(item.startDate), item.dayOfMonth);
      return candidate >= item.startDate
        ? candidate
        : addMonthsClamped(candidate, 1, item.dayOfMonth);
    }
    case "yearly":
      return item.startDate;
    case "weekly":
    case "daily":
    default:
      return item.startDate;
  }
}

function advance(item: RecurringExpense, date: string): string {
  switch (item.frequency) {
    case "daily":
      return addDays(date, 1);
    case "weekly":
      return addDays(date, 7);
    case "monthly":
      return addMonthsClamped(date, 1, item.dayOfMonth);
    case "yearly":
      return addYears(date, 1);
    default:
      return addMonthsClamped(date, 1, item.dayOfMonth);
  }
}

function occurrences(item: RecurringExpense, today: string): string[] {
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

export function materializeRecurring(
  recurring: RecurringExpense[],
  now: Date = new Date(),
): MaterializationResult {
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
        description: item.description,
        amount: item.amount,
        category: item.category,
        date,
        createdAt: now.toISOString(),
        recurringId: item.id,
        accountId: item.accountId,
        spaceId: item.spaceId,
        tags: [],
        attachments: [],
      });
    }
    changed = true;
    return { ...item, lastMaterializedDate: dueDates[dueDates.length - 1] };
  });

  return { newExpenses, updatedRecurring, changed };
}

export function nextDueDate(
  item: RecurringExpense,
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
