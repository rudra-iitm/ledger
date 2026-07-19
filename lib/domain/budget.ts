import type { Budgets, Category, Expense } from "./types";
import { currentMonth, monthOf } from "./dates";
import { roundMoney } from "./money";
import { isSpend } from "./transactions";

export interface BudgetSummary {
  spent: number;
  budget: number;
  remaining: number;
  progress: number;
  overBudget: boolean;
}

export function monthExpenses(
  expenses: Expense[],
  month: string = currentMonth(),
): Expense[] {
  return expenses.filter((expense) => monthOf(expense.date) === month);
}

export function monthSpending(
  expenses: Expense[],
  month: string = currentMonth(),
): number {
  return roundMoney(
    monthExpenses(expenses, month)
      .filter(isSpend)
      .reduce((total, expense) => total + expense.amount, 0),
  );
}

function summarize(spent: number, budget: number): BudgetSummary {
  const remaining = roundMoney(budget - spent);
  const progress =
    budget > 0 ? Math.min(1, spent / budget) : spent > 0 ? 1 : 0;
  return {
    spent: roundMoney(spent),
    budget,
    remaining,
    progress,
    overBudget: budget > 0 && spent > budget,
  };
}

export function budgetSummary(
  expenses: Expense[],
  monthlyBudget: number,
  month: string = currentMonth(),
): BudgetSummary {
  return summarize(monthSpending(expenses, month), monthlyBudget);
}

export interface CategoryBudgetSummary extends BudgetSummary {
  category: Category;
  nearLimit: boolean;
}

export function categoryBudgetSummaries(
  expenses: Expense[],
  budgets: Budgets,
  month: string = currentMonth(),
): CategoryBudgetSummary[] {
  const monthly = monthExpenses(expenses, month).filter(isSpend);
  const spentByCategory = new Map<Category, number>();
  for (const expense of monthly) {
    spentByCategory.set(
      expense.category,
      (spentByCategory.get(expense.category) ?? 0) + expense.amount,
    );
  }

  return Object.entries(budgets.categoryBudgets)
    .filter(([, limit]) => typeof limit === "number" && limit > 0)
    .map(([category, limit]) => {
      const spent = spentByCategory.get(category as Category) ?? 0;
      const summary = summarize(spent, limit as number);
      return {
        ...summary,
        category: category as Category,
        nearLimit: !summary.overBudget && summary.progress >= 0.8,
      };
    })
    .sort((a, b) => b.progress - a.progress);
}

/**
 * Budget suggestions from history: per-category median of the last three
 * full months (categories seen in at least two of them), rounded up to a
 * friendly ₹100 step. The overall suggestion is the sum of the categories.
 */
export function suggestBudgets(
  expenses: Expense[],
  now: Date = new Date(),
): { monthlyBudget: number; categoryBudgets: Partial<Record<Category, number>> } {
  const months: string[] = [];
  let month = currentMonth(now);
  for (let i = 0; i < 3; i += 1) {
    month = previousMonthOf(month);
    months.push(month);
  }
  const perCategory = new Map<Category, number[]>();
  for (const row of expenses) {
    if (!isSpend(row)) continue;
    const rowMonth = monthOf(row.date);
    if (!months.includes(rowMonth)) continue;
    const totals = perCategory.get(row.category) ?? [];
    const index = months.indexOf(rowMonth);
    totals[index] = roundMoney((totals[index] ?? 0) + row.amount);
    perCategory.set(row.category, totals);
  }
  const categoryBudgets: Partial<Record<Category, number>> = {};
  let total = 0;
  for (const [category, sparse] of perCategory) {
    const totals = sparse.filter((value): value is number => Boolean(value));
    if (totals.length < 2) continue;
    const sorted = [...totals].sort((a, b) => a - b);
    const median =
      sorted.length % 2 === 1
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const rounded = Math.ceil(median / 100) * 100;
    if (rounded <= 0) continue;
    categoryBudgets[category] = rounded;
    total += rounded;
  }
  return { monthlyBudget: total, categoryBudgets };
}

function previousMonthOf(month: string): string {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const date = new Date(year, monthNumber - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
