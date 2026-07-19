import { describe, expect, it } from "vitest";
import type { Expense } from "@/lib/domain/types";
import {
  mineRecurring,
  suggestionTarget,
  suggestionToRecurring,
  suggestionToSubscription,
} from "@/lib/domain/ingest/recurrence";

const NOW = new Date(2026, 6, 19); // 19 Jul 2026

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: Math.random().toString(36).slice(2),
    description: "Netflix",
    amount: 649,
    category: "Bills",
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

function series(dates: string[], overrides: Partial<Expense> = {}): Expense[] {
  return dates.map((date) => expense({ date, ...overrides }));
}

const NO_EXISTING = { subscriptions: [], recurring: [], dismissed: [] };

describe("mineRecurring", () => {
  it("detects a stable monthly subscription", () => {
    const rows = series(["2026-04-05", "2026-05-05", "2026-06-05", "2026-07-05"]);
    const [suggestion] = mineRecurring(rows, NO_EXISTING, NOW);
    expect(suggestion).toMatchObject({
      merchant: "Netflix",
      cadence: "monthly",
      amountStable: true,
      kind: "subscription",
      occurrences: 4,
      averageAmount: 649,
    });
    expect(suggestion.nextExpected >= "2026-07-19").toBe(true);
  });

  it("detects variable monthly bills within ±25% and flags EMIs", () => {
    const bill = series(
      ["2026-05-10", "2026-06-10", "2026-07-10"],
      { description: "BESCOM ELECTRICITY", amount: 0 },
    ).map((row, index) => ({ ...row, amount: [1100, 1250, 990][index] }));
    const emi = series(
      ["2026-05-03", "2026-06-03", "2026-07-03"],
      { description: "HDFC CAR LOAN EMI", amount: 12500 },
    );
    const result = mineRecurring([...bill, ...emi], NO_EXISTING, NOW);
    const kinds = Object.fromEntries(result.map((s) => [s.merchant, s.kind]));
    expect(kinds["BESCOM ELECTRICITY"]).toBe("bill");
    expect(kinds["HDFC CAR LOAN EMI"]).toBe("emi");
  });

  it("ignores irregular purchases and high-variance merchants", () => {
    const irregular = series(["2026-05-01", "2026-05-04", "2026-07-18"]);
    const variance = series(
      ["2026-05-05", "2026-06-05", "2026-07-05"],
      { description: "Amazon", amount: 0 },
    ).map((row, index) => ({ ...row, amount: [500, 4000, 900][index] }));
    expect(mineRecurring([...irregular, ...variance], NO_EXISTING, NOW)).toEqual([]);
  });

  it("excludes already-tracked merchants and dismissed keys", () => {
    const rows = series(["2026-04-05", "2026-05-05", "2026-06-05"]);
    const tracked = mineRecurring(
      rows,
      {
        subscriptions: [
          {
            id: "s1",
            name: "netflix",
            amount: 649,
            billingCycle: "monthly",
            category: "Bills",
            nextRenewalDate: "2026-08-05",
            active: true,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        recurring: [],
        dismissed: [],
      },
      NOW,
    );
    expect(tracked).toEqual([]);

    const [suggestion] = mineRecurring(rows, NO_EXISTING, NOW);
    const dismissed = mineRecurring(
      rows,
      { ...NO_EXISTING, dismissed: [suggestion.key] },
      NOW,
    );
    expect(dismissed).toEqual([]);
  });

  it("skips rows already linked to a subscription or recurring template", () => {
    const rows = series(["2026-04-05", "2026-05-05", "2026-06-05"], {
      subscriptionId: "s1",
    });
    expect(mineRecurring(rows, NO_EXISTING, NOW)).toEqual([]);
  });
});

describe("suggestion conversion", () => {
  const rows = series(["2026-04-05", "2026-05-05", "2026-06-05", "2026-07-05"]);
  const [subscriptionish] = mineRecurring(rows, NO_EXISTING, NOW);

  it("stable amounts become subscriptions", () => {
    expect(suggestionTarget(subscriptionish)).toBe("subscription");
    expect(suggestionToSubscription(subscriptionish)).toMatchObject({
      name: "Netflix",
      billingCycle: "monthly",
      active: true,
    });
  });

  it("variable bills become recurring templates with a future start", () => {
    const bill = series(
      ["2026-05-10", "2026-06-10", "2026-07-10"],
      { description: "BESCOM ELECTRICITY", amount: 0 },
    ).map((row, index) => ({ ...row, amount: [1100, 1250, 990][index] }));
    const [suggestion] = mineRecurring(bill, NO_EXISTING, NOW);
    expect(suggestionTarget(suggestion)).toBe("recurring");
    const template = suggestionToRecurring(suggestion);
    expect(template.frequency).toBe("monthly");
    expect(template.startDate >= "2026-07-19").toBe(true);
    expect(template.dayOfMonth).toBe(10);
  });
});
