import type { Expense, RecurringExpense } from "./types";
import {
  clampedDateInMonth,
  compareMonths,
  currentMonth,
  monthOf,
  nextMonth,
  todayISO,
} from "./dates";
import { createId } from "./id";

export interface MaterializationResult {
  newExpenses: Expense[];
  updatedRecurring: RecurringExpense[];
  changed: boolean;
}

export function materializeRecurring(
  recurring: RecurringExpense[],
  now: Date = new Date(),
): MaterializationResult {
  const today = todayISO(now);
  const thisMonth = currentMonth(now);
  const newExpenses: Expense[] = [];
  let changed = false;

  const updatedRecurring = recurring.map((item) => {
    if (!item.active) return item;

    let month = item.lastMaterializedMonth
      ? nextMonth(item.lastMaterializedMonth)
      : item.startMonth;
    let lastMaterializedMonth = item.lastMaterializedMonth;

    while (compareMonths(month, thisMonth) <= 0) {
      const dueDate = clampedDateInMonth(month, item.dayOfMonth);
      if (dueDate > today) break;

      newExpenses.push({
        id: createId(),
        description: item.description,
        amount: item.amount,
        category: item.category,
        date: dueDate,
        createdAt: now.toISOString(),
        recurringId: item.id,
      });
      lastMaterializedMonth = month;
      month = nextMonth(month);
    }

    if (lastMaterializedMonth !== item.lastMaterializedMonth) {
      changed = true;
      return { ...item, lastMaterializedMonth };
    }
    return item;
  });

  return { newExpenses, updatedRecurring, changed };
}

export function nextDueDate(
  item: RecurringExpense,
  now: Date = new Date(),
): string {
  const today = todayISO(now);
  let month = item.lastMaterializedMonth
    ? nextMonth(item.lastMaterializedMonth)
    : item.startMonth;
  if (compareMonths(month, monthOf(today)) < 0) {
    month = monthOf(today);
  }
  let due = clampedDateInMonth(month, item.dayOfMonth);
  if (item.lastMaterializedMonth && due <= today) {
    due = clampedDateInMonth(nextMonth(month), item.dayOfMonth);
  }
  return due;
}
