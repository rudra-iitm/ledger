import { describe, expect, it } from "vitest";
import { budgetSummary, monthSpending } from "@/lib/domain/budget";
import type { Expense } from "@/lib/domain/types";

function makeExpense(date: string, amount: number): Expense {
  return {
    id: `${date}-${amount}`,
    description: "x",
    amount,
    category: "Other",
    date,
    createdAt: `${date}T00:00:00.000Z`,
  };
}

describe("monthSpending", () => {
  it("sums only the given month", () => {
    const expenses = [
      makeExpense("2026-06-01", 100),
      makeExpense("2026-06-15", 50.25),
      makeExpense("2026-05-31", 999),
    ];
    expect(monthSpending(expenses, "2026-06")).toBe(150.25);
  });
});

describe("budgetSummary", () => {
  it("computes remaining and progress", () => {
    const expenses = [makeExpense("2026-06-01", 300)];
    const summary = budgetSummary(expenses, 1000, "2026-06");
    expect(summary).toEqual({
      spent: 300,
      budget: 1000,
      remaining: 700,
      progress: 0.3,
    });
  });

  it("caps progress at 1 when over budget", () => {
    const expenses = [makeExpense("2026-06-01", 1500)];
    const summary = budgetSummary(expenses, 1000, "2026-06");
    expect(summary.remaining).toBe(-500);
    expect(summary.progress).toBe(1);
  });

  it("handles no budget", () => {
    const summary = budgetSummary([], 0, "2026-06");
    expect(summary.progress).toBe(0);
  });
});
