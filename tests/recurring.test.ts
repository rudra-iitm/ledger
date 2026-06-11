import { describe, expect, it } from "vitest";
import { materializeRecurring, nextDueDate } from "@/lib/domain/recurring";
import type { RecurringExpense } from "@/lib/domain/types";

function makeRecurring(
  overrides: Partial<RecurringExpense> = {},
): RecurringExpense {
  return {
    id: "r1",
    description: "Rent",
    amount: 15000,
    category: "Bills",
    dayOfMonth: 1,
    startMonth: "2026-04",
    active: true,
    createdAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("materializeRecurring", () => {
  it("creates an expense for each due month since start", () => {
    const result = materializeRecurring(
      [makeRecurring()],
      new Date(2026, 5, 10),
    );
    expect(result.changed).toBe(true);
    expect(result.newExpenses.map((expense) => expense.date)).toEqual([
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
    ]);
    expect(result.updatedRecurring[0].lastMaterializedMonth).toBe("2026-06");
    expect(result.newExpenses[0]).toMatchObject({
      description: "Rent",
      amount: 15000,
      category: "Bills",
      recurringId: "r1",
    });
  });

  it("skips months already materialized", () => {
    const result = materializeRecurring(
      [makeRecurring({ lastMaterializedMonth: "2026-05" })],
      new Date(2026, 5, 10),
    );
    expect(result.newExpenses.map((expense) => expense.date)).toEqual([
      "2026-06-01",
    ]);
  });

  it("does not materialize before the due day", () => {
    const result = materializeRecurring(
      [makeRecurring({ dayOfMonth: 20, lastMaterializedMonth: "2026-05" })],
      new Date(2026, 5, 10),
    );
    expect(result.changed).toBe(false);
    expect(result.newExpenses).toEqual([]);
  });

  it("clamps day 31 to shorter months", () => {
    const result = materializeRecurring(
      [makeRecurring({ dayOfMonth: 31, startMonth: "2026-02" })],
      new Date(2026, 1, 28),
    );
    expect(result.newExpenses.map((expense) => expense.date)).toEqual([
      "2026-02-28",
    ]);
  });

  it("ignores paused items", () => {
    const result = materializeRecurring(
      [makeRecurring({ active: false })],
      new Date(2026, 5, 10),
    );
    expect(result.changed).toBe(false);
    expect(result.newExpenses).toEqual([]);
  });
});

describe("nextDueDate", () => {
  it("returns the upcoming due date after materialization", () => {
    const item = makeRecurring({ lastMaterializedMonth: "2026-06" });
    expect(nextDueDate(item, new Date(2026, 5, 10))).toBe("2026-07-01");
  });

  it("returns the pending due date in the current month", () => {
    const item = makeRecurring({
      dayOfMonth: 20,
      lastMaterializedMonth: "2026-05",
    });
    expect(nextDueDate(item, new Date(2026, 5, 10))).toBe("2026-06-20");
  });
});
