import type { Expense, Space } from "./types";
import { roundMoney } from "./money";
import { isSpend } from "./transactions";

export function spaceExpenses(
  expenses: Expense[],
  spaceId: string,
): Expense[] {
  return expenses.filter(
    (expense) => isSpend(expense) && expense.spaceId === spaceId,
  );
}

export interface SpaceSummary {
  spent: number;
  budget: number;
  remaining: number;
  count: number;
  progress: number;
  overBudget: boolean;
}

export function spaceSummary(expenses: Expense[], space: Space): SpaceSummary {
  const owned = spaceExpenses(expenses, space.id);
  const spent = roundMoney(
    owned.reduce((total, expense) => total + expense.amount, 0),
  );
  const remaining = roundMoney(space.budget - spent);
  const progress =
    space.budget > 0 ? Math.min(1, spent / space.budget) : spent > 0 ? 1 : 0;
  return {
    spent,
    budget: space.budget,
    remaining,
    count: owned.length,
    progress,
    overBudget: space.budget > 0 && spent > space.budget,
  };
}

export interface RankedSpace {
  space: Space;
  spent: number;
}

export function rankSpacesBySpending(
  expenses: Expense[],
  spaces: Space[],
): RankedSpace[] {
  return spaces
    .map((space) => ({
      space,
      spent: spaceSummary(expenses, space).spent,
    }))
    .filter((entry) => entry.spent > 0)
    .sort((a, b) => b.spent - a.spent);
}
