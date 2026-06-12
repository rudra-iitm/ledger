import { CATEGORIES, type Category, type Expense } from "./types";
import { resolveBrand } from "@/lib/brands/registry";
import { startOfWeek } from "./dates";
import { roundMoney } from "./money";
import { inRange, rangeLength, type DateRange } from "./time-ranges";

export interface ExpenseFilter {
  range?: DateRange;
  category?: Category | null;
  accountId?: string | null;
  accountIds?: string[] | null;
  spaceId?: string | null;
  tags?: string[];
  query?: string;
}

export function filterExpenses(
  expenses: Expense[],
  filter: ExpenseFilter,
): Expense[] {
  const query = filter.query?.trim().toLowerCase();
  return expenses.filter((expense) => {
    if (filter.range && !inRange(expense.date, filter.range)) return false;
    if (filter.category && expense.category !== filter.category) return false;
    if (filter.accountId && expense.accountId !== filter.accountId) {
      return false;
    }
    if (
      filter.accountIds &&
      (!expense.accountId || !filter.accountIds.includes(expense.accountId))
    ) {
      return false;
    }
    if (filter.spaceId && expense.spaceId !== filter.spaceId) return false;
    if (filter.tags && filter.tags.length > 0) {
      if (!filter.tags.every((tag) => expense.tags.includes(tag))) return false;
    }
    if (query) {
      const brand = resolveBrand(`${expense.description} ${expense.notes || ""}`);
      const haystack = [
        expense.description,
        expense.category,
        expense.notes ?? "",
        expense.tags.join(" "),
        brand ? brand.name : "",
        brand ? brand.aliases.join(" ") : "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function totalSpending(expenses: Expense[]): number {
  return roundMoney(
    expenses.reduce((total, expense) => total + expense.amount, 0),
  );
}

export interface CategoryBreakdown {
  category: Category;
  total: number;
  count: number;
  percentage: number;
}

export function breakdownByCategory(expenses: Expense[]): CategoryBreakdown[] {
  const totals = new Map<Category, { total: number; count: number }>();
  for (const expense of expenses) {
    const entry = totals.get(expense.category) ?? { total: 0, count: 0 };
    entry.total += expense.amount;
    entry.count += 1;
    totals.set(expense.category, entry);
  }
  const grandTotal = totalSpending(expenses);
  return CATEGORIES.map((category) => {
    const entry = totals.get(category) ?? { total: 0, count: 0 };
    return {
      category,
      total: roundMoney(entry.total),
      count: entry.count,
      percentage: grandTotal > 0 ? (entry.total / grandTotal) * 100 : 0,
    };
  })
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.total - a.total);
}

export interface DailyPoint {
  date: string;
  total: number;
}

export function dailyTotals(expenses: Expense[]): DailyPoint[] {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(expense.date, (totals.get(expense.date) ?? 0) + expense.amount);
  }
  return Array.from(totals.entries())
    .map(([date, total]) => ({ date, total: roundMoney(total) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function averageDailySpend(
  expenses: Expense[],
  range: DateRange,
): number {
  const days = rangeLength(range);
  if (days === 0) return 0;
  return roundMoney(totalSpending(expenses) / days);
}

export type Granularity = "day" | "week" | "month";

export interface BucketPoint {
  key: string;
  label: string;
  total: number;
}

function weekKey(isoDate: string): string {
  return startOfWeek(isoDate);
}

export function bucketedTotals(
  expenses: Expense[],
  granularity: Granularity,
): BucketPoint[] {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const key =
      granularity === "day"
        ? expense.date
        : granularity === "week"
          ? weekKey(expense.date)
          : expense.date.slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + expense.amount);
  }
  return Array.from(totals.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, total]) => ({
      key,
      label:
        granularity === "month"
          ? key
          : granularity === "week"
            ? key.slice(5)
            : key.slice(5),
      total: roundMoney(total),
    }));
}
