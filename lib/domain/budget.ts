import type { Expense } from "./types";
import { currentMonth, monthOf } from "./dates";
import { roundMoney } from "./money";

export interface BudgetSummary {
  spent: number;
  budget: number;
  remaining: number;
  progress: number;
}

export function monthSpending(
  expenses: Expense[],
  month: string = currentMonth(),
): number {
  return roundMoney(
    expenses
      .filter((expense) => monthOf(expense.date) === month)
      .reduce((total, expense) => total + expense.amount, 0),
  );
}

export function budgetSummary(
  expenses: Expense[],
  monthlyBudget: number,
  month: string = currentMonth(),
): BudgetSummary {
  const spent = monthSpending(expenses, month);
  const remaining = roundMoney(monthlyBudget - spent);
  const progress =
    monthlyBudget > 0 ? Math.min(1, spent / monthlyBudget) : spent > 0 ? 1 : 0;
  return { spent, budget: monthlyBudget, remaining, progress };
}
