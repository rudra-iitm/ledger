import { describe, expect, it } from "vitest";
import type { Expense, Subscription } from "@/lib/domain/types";
import { DEFAULT_ACCOUNTS, DEFAULT_BUDGETS } from "@/lib/domain/types";
import { detectAnomalies } from "@/lib/domain/anomalies";
import { suggestBudgets } from "@/lib/domain/budget";
import { healthReport } from "@/lib/domain/health";
import { interpretSearch } from "@/lib/domain/smart-search";

const NOW = new Date(2026, 6, 20); // 20 Jul 2026

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: Math.random().toString(36).slice(2),
    description: "Item",
    amount: 100,
    category: "Other",
    date: "2026-07-10",
    type: "expense",
    accountId: "acc-bank",
    affectsBalance: true,
    tags: [],
    attachments: [],
    createdAt: "2026-07-10T00:00:00.000Z",
    ...overrides,
  };
}

const netflix: Subscription = {
  id: "sub-nf",
  name: "Netflix",
  amount: 649,
  billingCycle: "monthly",
  category: "Bills",
  nextRenewalDate: "2026-08-18",
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("detectAnomalies", () => {
  it("flags double charges within 48h", () => {
    const rows = [
      expense({ id: "a", description: "Swiggy", amount: 450, date: "2026-07-18" }),
      expense({ id: "b", description: "Swiggy", amount: 450, date: "2026-07-19" }),
    ];
    const alerts = detectAnomalies(
      { expenses: rows, subscriptions: [], currency: "₹", dismissed: [] },
      NOW,
    );
    expect(alerts.some((alert) => alert.key === "dup:b")).toBe(true);
  });

  it("flags subscription price hikes and respects dismissal", () => {
    const rows = [
      expense({ description: "Netflix", amount: 699, date: "2026-07-18", category: "Bills" }),
    ];
    const alerts = detectAnomalies(
      { expenses: rows, subscriptions: [netflix], currency: "₹", dismissed: [] },
      NOW,
    );
    const hike = alerts.find((alert) => alert.key.startsWith("hike:sub-nf"));
    expect(hike?.title).toContain("Netflix");
    const dismissed = detectAnomalies(
      { expenses: rows, subscriptions: [netflix], currency: "₹", dismissed: [hike!.key] },
      NOW,
    );
    expect(dismissed.find((alert) => alert.key === hike!.key)).toBeUndefined();
  });

  it("flags a category running far above its average", () => {
    const rows = [
      expense({ category: "Shopping", amount: 1000, date: "2026-04-10" }),
      expense({ category: "Shopping", amount: 1200, date: "2026-05-10" }),
      expense({ category: "Shopping", amount: 900, date: "2026-06-10" }),
      expense({ category: "Shopping", amount: 4000, date: "2026-07-10" }),
    ];
    const alerts = detectAnomalies(
      { expenses: rows, subscriptions: [], currency: "₹", dismissed: [] },
      NOW,
    );
    expect(alerts.some((alert) => alert.key === "spike:Shopping:2026-07")).toBe(true);
  });

  it("stays quiet on normal months", () => {
    const rows = [
      expense({ category: "Food", amount: 5000, date: "2026-06-10" }),
      expense({ category: "Food", amount: 5100, date: "2026-05-10" }),
      expense({ category: "Food", amount: 5200, date: "2026-07-10" }),
    ];
    expect(
      detectAnomalies(
        { expenses: rows, subscriptions: [], currency: "₹", dismissed: [] },
        NOW,
      ),
    ).toEqual([]);
  });
});

describe("suggestBudgets", () => {
  it("uses per-category medians of the last 3 full months, rounded to 100", () => {
    const rows = [
      expense({ category: "Food", amount: 4100, date: "2026-04-15" }),
      expense({ category: "Food", amount: 5150, date: "2026-05-15" }),
      expense({ category: "Food", amount: 4900, date: "2026-06-15" }),
      // single-month category — excluded
      expense({ category: "Travel", amount: 3000, date: "2026-06-20" }),
      // current month — ignored
      expense({ category: "Food", amount: 9999, date: "2026-07-10" }),
    ];
    const suggestion = suggestBudgets(rows, NOW);
    expect(suggestion.categoryBudgets.Food).toBe(4900);
    expect(suggestion.categoryBudgets.Travel).toBeUndefined();
    expect(suggestion.monthlyBudget).toBe(4900);
  });
});

describe("healthReport", () => {
  it("scores savings, emergency fund, and debt from real history", () => {
    const accounts = [
      { ...DEFAULT_ACCOUNTS[1], balance: 120000 },
      {
        ...DEFAULT_ACCOUNTS[1],
        id: "acc-card",
        name: "Card",
        type: "credit_card" as const,
        balance: 0,
      },
    ];
    const rows = [
      // 3 months of income 100k / spend 40k
      ...[4, 5, 6].flatMap((month) => [
        expense({
          type: "income",
          incomeCategory: "Salary",
          amount: 100000,
          date: `2026-0${month}-01`,
        }),
        expense({ amount: 40000, date: `2026-0${month}-10`, category: "Bills" }),
      ]),
    ];
    const report = healthReport(
      { expenses: rows, accounts, budgets: DEFAULT_BUDGETS },
      NOW,
    );
    const byKey = Object.fromEntries(
      report.components.map((component) => [component.key, component]),
    );
    expect(byKey.savings.score).toBe(100); // 60% rate ≥ 30%
    expect(byKey.savings.value).toBe("60%");
    expect(byKey.emergency.value).toBe("3.0 months");
    expect(byKey.emergency.score).toBe(50);
    expect(byKey.debt.score).toBe(100);
    expect(report.thin).toBe(false);
    expect(report.score).toBeGreaterThan(50);
  });

  it("degrades gracefully with no data", () => {
    const report = healthReport(
      { expenses: [], accounts: DEFAULT_ACCOUNTS, budgets: DEFAULT_BUDGETS },
      NOW,
    );
    expect(report.thin).toBe(true);
    expect(report.score).toBeGreaterThan(0);
  });
});

describe("interpretSearch", () => {
  it("compiles category + preset + free text", () => {
    expect(interpretSearch("food last month")).toMatchObject({
      category: "Food",
      preset: "lastMonth",
      query: "",
    });
    expect(interpretSearch("amazon this year")).toMatchObject({
      preset: "thisYear",
      query: "amazon",
    });
    expect(interpretSearch("bills yesterday")).toMatchObject({
      category: "Bills",
      preset: "yesterday",
    });
    expect(interpretSearch("investments this fy")?.preset).toBe("thisFY");
  });

  it("returns null when nothing structured is present", () => {
    expect(interpretSearch("swiggy")).toBeNull();
    expect(interpretSearch("")).toBeNull();
  });
});
