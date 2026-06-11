import type { Budgets, Category, Expense } from "./types";
import { currentMonth, monthOf } from "./dates";
import { roundMoney } from "./money";

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
    monthExpenses(expenses, month).reduce(
      (total, expense) => total + expense.amount,
      0,
    ),
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
  const monthly = monthExpenses(expenses, month);
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
