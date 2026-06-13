import type {
  Account,
  Category,
  Expense,
  Space,
  Subscription,
} from "./types";
import {
  currentMonth,
  daysInMonth,
  formatDisplayMonth,
  monthOf,
  previousMonth,
} from "./dates";
import { roundMoney } from "./money";
import { breakdownByCategory, totalSpending } from "./analytics";
import { rankSpacesBySpending } from "./spaces";
import { rankAccountsBySpending } from "./accounts";
import { monthlyCost, totalMonthlyCost } from "./subscriptions";
import { isSpend } from "./transactions";

export interface ReviewOverview {
  spent: number;
  budget: number;
  remaining: number;
  savingsRate: number;
}

export interface ReviewHighlight {
  label: string;
  value: string;
  detail?: string;
}

export interface CategoryChange {
  category: Category;
  current: number;
  previous: number;
  changePct: number;
}

export interface MonthlyReview {
  month: string;
  label: string;
  hasData: boolean;
  overview: ReviewOverview;
  highlights: ReviewHighlight[];
  categoryChanges: CategoryChange[];
  topSpaces: Array<{ space: Space; spent: number }>;
  accountInsights: {
    mostUsed: Account | null;
    highestSpend: { account: Account; spent: number } | null;
    balances: Account[];
  };
  subscriptionInsights: {
    monthlyTotal: number;
    annualProjection: number;
    activeCount: number;
  };
}

function monthExpenses(expenses: Expense[], month: string): Expense[] {
  return expenses.filter((expense) => monthOf(expense.date) === month);
}

export interface ReviewInput {
  expenses: Expense[];
  spaces: Space[];
  accounts: Account[];
  subscriptions: Subscription[];
  monthlyBudget: number;
  currency: string;
}

export function buildMonthlyReview(
  input: ReviewInput,
  month: string = currentMonth(),
): MonthlyReview {
  const { expenses, spaces, accounts, subscriptions, monthlyBudget, currency } =
    input;
  const money = (value: number) =>
    `${currency}${Math.round(value).toLocaleString("en-IN")}`;

  const current = monthExpenses(expenses, month).filter(isSpend);
  const prevMonth = previousMonth(month);
  const previous = monthExpenses(expenses, prevMonth).filter(isSpend);

  const spent = totalSpending(current);
  const remaining = roundMoney(monthlyBudget - spent);
  const savingsRate =
    monthlyBudget > 0
      ? Math.max(0, Math.round(((monthlyBudget - spent) / monthlyBudget) * 100))
      : 0;

  const highlights: ReviewHighlight[] = [];

  const largest = [...current].sort((a, b) => b.amount - a.amount)[0];
  if (largest) {
    highlights.push({
      label: "Largest expense",
      value: money(largest.amount),
      detail: largest.description,
    });
  }

  const categories = breakdownByCategory(current);
  if (categories[0]) {
    highlights.push({
      label: "Most used category",
      value: categories[0].category,
      detail: `${categories[0].count} transactions`,
    });
  }

  const accountRanking = rankAccountsBySpending(expenses, accounts, month);
  if (accountRanking[0]) {
    highlights.push({
      label: "Most used account",
      value: accountRanking[0].account.name,
      detail: money(accountRanking[0].spent),
    });
  }

  const byDay = new Map<string, number>();
  for (const expense of current) {
    byDay.set(expense.date, (byDay.get(expense.date) ?? 0) + expense.amount);
  }
  const topDay = Array.from(byDay.entries()).sort((a, b) => b[1] - a[1])[0];
  if (topDay) {
    highlights.push({
      label: "Most expensive day",
      value: money(topDay[1]),
      detail: topDay[0],
    });
  }

  const days = daysInMonth(month);
  if (current.length > 0) {
    highlights.push({
      label: "Average daily spend",
      value: money(roundMoney(spent / days)),
    });
    highlights.push({
      label: "Average weekly spend",
      value: money(roundMoney((spent / days) * 7)),
    });
  }

  const currentByCat = new Map<Category, number>();
  const previousByCat = new Map<Category, number>();
  for (const expense of current) {
    currentByCat.set(
      expense.category,
      (currentByCat.get(expense.category) ?? 0) + expense.amount,
    );
  }
  for (const expense of previous) {
    previousByCat.set(
      expense.category,
      (previousByCat.get(expense.category) ?? 0) + expense.amount,
    );
  }
  const categoryKeys = new Set<Category>([
    ...currentByCat.keys(),
    ...previousByCat.keys(),
  ]);
  const categoryChanges: CategoryChange[] = Array.from(categoryKeys)
    .map((category) => {
      const cur = roundMoney(currentByCat.get(category) ?? 0);
      const prev = roundMoney(previousByCat.get(category) ?? 0);
      const changePct =
        prev > 0
          ? Math.round(((cur - prev) / prev) * 100)
          : cur > 0
            ? 100
            : 0;
      return { category, current: cur, previous: prev, changePct };
    })
    .filter((entry) => entry.current > 0 || entry.previous > 0)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  const mostUsed = accountRanking[0]?.account ?? null;

  return {
    month,
    label: formatDisplayMonth(month),
    hasData: current.length > 0,
    overview: { spent, budget: monthlyBudget, remaining, savingsRate },
    highlights,
    categoryChanges,
    topSpaces: rankSpacesBySpending(current, spaces).slice(0, 5),
    accountInsights: {
      mostUsed,
      highestSpend: accountRanking[0] ?? null,
      balances: accounts.filter((account) => !account.archived),
    },
    subscriptionInsights: {
      monthlyTotal: totalMonthlyCost(subscriptions),
      annualProjection: roundMoney(totalMonthlyCost(subscriptions) * 12),
      activeCount: subscriptions.filter((s) => s.active).length,
    },
  };
}

export function subscriptionMonthlyBreakdown(
  subscriptions: Subscription[],
): Array<{ category: Category; total: number }> {
  const totals = new Map<Category, number>();
  for (const subscription of subscriptions) {
    if (!subscription.active) continue;
    totals.set(
      subscription.category,
      (totals.get(subscription.category) ?? 0) + monthlyCost(subscription),
    );
  }
  return Array.from(totals, ([category, total]) => ({
    category,
    total: roundMoney(total),
  })).sort((a, b) => b.total - a.total);
}
