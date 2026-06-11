import type { Expense } from "./types";
import {
  addDays,
  daysInMonth,
  monthOf,
  startOfWeek,
  toISODate,
  weekdayOf,
} from "./dates";
import { roundMoney } from "./money";

export interface CalendarDay {
  date: string;
  inMonth: boolean;
  total: number;
  count: number;
}

export interface DayTotal {
  total: number;
  count: number;
}

export function dailyTotalsMap(expenses: Expense[]): Map<string, DayTotal> {
  const totals = new Map<string, DayTotal>();
  for (const expense of expenses) {
    const entry = totals.get(expense.date) ?? { total: 0, count: 0 };
    entry.total = roundMoney(entry.total + expense.amount);
    entry.count += 1;
    totals.set(expense.date, entry);
  }
  return totals;
}

export function monthMatrix(
  month: string,
  expenses: Expense[],
  weekStartsOn = 1,
): CalendarDay[][] {
  const totals = dailyTotalsMap(expenses);
  const firstDay = `${month}-01`;
  const gridStart = startOfWeek(firstDay, weekStartsOn);
  const weeks: CalendarDay[][] = [];

  let cursor = gridStart;
  for (let week = 0; week < 6; week += 1) {
    const row: CalendarDay[] = [];
    for (let day = 0; day < 7; day += 1) {
      const entry = totals.get(cursor);
      row.push({
        date: cursor,
        inMonth: monthOf(cursor) === month,
        total: entry?.total ?? 0,
        count: entry?.count ?? 0,
      });
      cursor = addDays(cursor, 1);
    }
    weeks.push(row);
    if (monthOf(cursor) !== month && week >= 4) break;
  }
  return weeks;
}

export function weekDays(anchor: string, weekStartsOn = 1): CalendarDay[] {
  const start = startOfWeek(anchor, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    return { date, inMonth: true, total: 0, count: 0 };
  });
}

export function maxDailyTotal(expenses: Expense[]): number {
  let max = 0;
  for (const { total } of dailyTotalsMap(expenses).values()) {
    if (total > max) max = total;
  }
  return max;
}

export { daysInMonth, toISODate, weekdayOf };
