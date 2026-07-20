import { describe, expect, it } from "vitest";
import {
  executeQuery,
  ledgerQuerySchema,
  summariseResult,
  type LedgerQuery,
} from "@/lib/domain/query";
import type { Account, Expense } from "@/lib/domain/types";
import { DEFAULT_ACCOUNTS } from "@/lib/domain/types";

const NOW = new Date("2026-07-20T12:00:00.000Z");

function expense(partial: Partial<Expense> & { id: string; date: string; amount: number }): Expense {
  return {
    description: "Thing",
    category: "Food",
    type: "expense",
    affectsBalance: true,
    tags: [],
    attachments: [],
    createdAt: `${partial.date}T00:00:00.000Z`,
    ...partial,
  } as Expense;
}

const EXPENSES: Expense[] = [
  expense({ id: "a", date: "2026-07-05", amount: 400, description: "Swiggy order", category: "Food" }),
  expense({ id: "b", date: "2026-07-12", amount: 1200, description: "Uber ride", category: "Travel" }),
  expense({ id: "c", date: "2026-07-18", amount: 600, description: "Swiggy order", category: "Food" }),
  expense({ id: "d", date: "2026-06-10", amount: 900, description: "Swiggy order", category: "Food" }),
  expense({
    id: "e",
    date: "2026-07-01",
    amount: 50000,
    description: "Salary",
    category: "Other",
    type: "income",
    incomeCategory: "Salary",
  }),
];

const INPUT = { expenses: EXPENSES, accounts: DEFAULT_ACCOUNTS as Account[], spaces: [] };

function query(overrides: Partial<LedgerQuery> = {}): LedgerQuery {
  return ledgerQuerySchema.parse(overrides);
}

describe("ledgerQuerySchema", () => {
  it("fills defaults so a sparse model response is still runnable", () => {
    const parsed = ledgerQuerySchema.parse({});
    expect(parsed).toMatchObject({
      intent: "total",
      rows: "spend",
      preset: "thisMonth",
      tags: [],
      text: "",
      limit: 25,
    });
  });

  it("rejects a category or preset the model invented", () => {
    expect(ledgerQuerySchema.safeParse({ category: "Groceries" }).success).toBe(false);
    expect(ledgerQuerySchema.safeParse({ preset: "lastDecade" }).success).toBe(false);
    expect(ledgerQuerySchema.safeParse({ limit: 5000 }).success).toBe(false);
  });
});

describe("executeQuery", () => {
  it("totals only spend rows by default, ignoring income", () => {
    const result = executeQuery(query({ preset: "thisMonth" }), INPUT, NOW);
    // 400 + 1200 + 600 — the ₹50,000 salary is income, not spend.
    expect(result.total).toBe(2200);
    expect(result.count).toBe(3);
  });

  it("switches to the income side when asked", () => {
    const result = executeQuery(query({ rows: "income", preset: "thisMonth" }), INPUT, NOW);
    expect(result.total).toBe(50000);
    expect(result.count).toBe(1);
  });

  it("filters by category and by free text", () => {
    expect(
      executeQuery(query({ category: "Food", preset: "thisMonth" }), INPUT, NOW).total,
    ).toBe(1000);
    expect(
      executeQuery(query({ text: "uber", preset: "thisMonth" }), INPUT, NOW).total,
    ).toBe(1200);
  });

  it("breaks down by category, largest first", () => {
    const result = executeQuery(
      query({ intent: "breakdown", preset: "thisMonth" }),
      INPUT,
      NOW,
    );
    expect(result.breakdown?.[0]).toMatchObject({ category: "Travel", total: 1200 });
    expect(result.breakdown?.[1]).toMatchObject({ category: "Food", total: 1000 });
  });

  it("compares two periods and reports the percentage change", () => {
    const result = executeQuery(
      query({
        intent: "compare",
        category: "Food",
        preset: "thisMonth",
        comparePreset: "lastMonth",
      }),
      INPUT,
      NOW,
    );
    // ₹1000 this month against ₹900 last month.
    expect(result.total).toBe(1000);
    expect(result.comparison?.total).toBe(900);
    expect(result.comparison?.changePct).toBe(11);
  });

  it("produces a time series for trend queries", () => {
    const result = executeQuery(
      query({ intent: "trend", preset: "thisMonth", groupBy: "week" }),
      INPUT,
      NOW,
    );
    expect(result.series?.length).toBeGreaterThan(0);
    expect(result.series?.reduce((sum, point) => sum + point.total, 0)).toBe(2200);
  });

  it("caps returned rows at the limit but reports the true count", () => {
    const result = executeQuery(
      query({ intent: "list", preset: "thisMonth", limit: 1 }),
      INPUT,
      NOW,
    );
    expect(result.rows).toHaveLength(1);
    expect(result.count).toBe(3);
  });

  it("returns zeroes rather than throwing on an empty ledger", () => {
    const result = executeQuery(query(), { expenses: [], accounts: [], spaces: [] }, NOW);
    expect(result.total).toBe(0);
    expect(result.count).toBe(0);
    expect(result.rows).toEqual([]);
  });

  it("honours a custom date range", () => {
    const result = executeQuery(
      query({ preset: "custom", start: "2026-07-01", end: "2026-07-10" }),
      INPUT,
      NOW,
    );
    expect(result.total).toBe(400);
  });
});

describe("summariseResult", () => {
  it("carries the numbers a narrator needs and stays compact", () => {
    const result = executeQuery(
      query({ intent: "breakdown", preset: "thisMonth" }),
      INPUT,
      NOW,
    );
    const summary = summariseResult(result, "₹");
    expect(summary).toContain("Matched 3 transaction(s)");
    expect(summary).toContain("2200.00");
    expect(summary).toContain("By category");
    // A prompt-sized payload, not a data dump.
    expect(summary.length).toBeLessThan(1500);
  });
});
