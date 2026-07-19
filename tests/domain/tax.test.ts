import { describe, expect, it } from "vitest";
import type { Expense } from "@/lib/domain/types";
import { DEFAULT_ACCOUNTS } from "@/lib/domain/types";
import { financialYearRange } from "@/lib/domain/time-ranges";
import { buildTaxPackCsv } from "@/lib/domain/tax";

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: Math.random().toString(36).slice(2),
    description: "Item",
    amount: 100,
    category: "Other",
    date: "2026-07-01",
    type: "expense",
    accountId: "acc-bank",
    affectsBalance: true,
    tags: [],
    attachments: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("financialYearRange", () => {
  it("handles both sides of the April boundary", () => {
    expect(financialYearRange("2026-07-19")).toMatchObject({
      start: "2026-04-01",
      end: "2027-03-31",
      label: "FY 2026-27",
    });
    expect(financialYearRange("2026-02-10")).toMatchObject({
      start: "2025-04-01",
      end: "2026-03-31",
      label: "FY 2025-26",
    });
    expect(financialYearRange("2026-07-19", 1)).toMatchObject({
      start: "2025-04-01",
      end: "2026-03-31",
    });
  });
});

describe("buildTaxPackCsv", () => {
  const rows: Expense[] = [
    expense({
      type: "income",
      incomeCategory: "Salary",
      source: "Acme",
      description: "July salary",
      amount: 150000,
    }),
    expense({
      description: "ELSS SIP",
      type: "investment",
      category: "Investments",
      amount: 5000,
      units: 12.345,
      transferAccountId: "acc-bank",
    }),
    expense({ description: "Term insurance", tags: ["80c"], amount: 12000 }),
    expense({ description: "Groceries", category: "Food", amount: 2000 }),
    expense({
      description: "Out of FY",
      type: "income",
      incomeCategory: "Freelance",
      date: "2026-03-31",
      amount: 999,
    }),
  ];

  it("sections income, deductions, investments, and category totals for the FY", () => {
    const pack = buildTaxPackCsv({
      expenses: rows,
      accounts: DEFAULT_ACCOUNTS,
      today: "2026-07-19",
    });
    expect(pack.label).toBe("FY 2026-27");
    expect(pack.csv).toContain("INCOME");
    expect(pack.csv).toContain("July salary");
    expect(pack.csv).toContain("Term insurance");
    expect(pack.csv).toContain("ELSS SIP");
    expect(pack.csv).toContain("SPENDING BY CATEGORY");
    expect(pack.csv).toContain("Food,2000");
    // FY filter: the 31-Mar-2026 row belongs to the previous FY
    expect(pack.csv).not.toContain("Out of FY");
    // Totals
    expect(pack.csv).toContain("TOTAL,,,,,150000");
  });

  it("last-FY pack picks up the earlier year", () => {
    const pack = buildTaxPackCsv({
      expenses: rows,
      accounts: DEFAULT_ACCOUNTS,
      yearsBack: 1,
      today: "2026-07-19",
    });
    expect(pack.label).toBe("FY 2025-26");
    expect(pack.csv).toContain("Out of FY");
    expect(pack.csv).not.toContain("July salary");
  });
});
