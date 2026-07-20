import { describe, expect, it } from "vitest";
import { buildComputedSignals, computedHeadline } from "@/lib/ai/agent/signals";
import { EMPTY_DATA, type LedgerData } from "@/lib/storage/repository";
import type { Account, Expense, RecurringExpense, Subscription } from "@/lib/domain/types";

const NOW = new Date(2026, 6, 20); // 20 Jul 2026, local time

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-bank",
    name: "Bank",
    type: "bank",
    balance: 10000,
    openingBalance: 0,
    icon: "🏦",
    archived: false,
    debitCards: [],
    reconciliations: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function recurring(overrides: Partial<RecurringExpense> = {}): RecurringExpense {
  return {
    id: "rec-rent",
    description: "Rent",
    amount: 9500,
    category: "Bills",
    kind: "expense",
    frequency: "monthly",
    dayOfMonth: 1,
    startDate: "2026-01-01",
    lastMaterializedDate: "2026-07-01",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-1",
    name: "Netflix",
    amount: 649,
    billingCycle: "monthly",
    category: "Entertainment",
    nextRenewalDate: "2026-07-22",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "exp-1",
    description: "Lunch",
    amount: 450,
    category: "Food",
    date: "2026-07-10",
    createdAt: "2026-07-10T00:00:00.000Z",
    ...overrides,
  } as Expense;
}

function data(overrides: Partial<LedgerData> = {}): LedgerData {
  return { ...EMPTY_DATA, accounts: [account()], ...overrides };
}

describe("buildComputedSignals", () => {
  it("says nothing when there is nothing to say", () => {
    expect(buildComputedSignals({ data: data(), now: NOW })).toEqual([]);
  });

  it("raises a critical, undismissable signal when the forecast goes negative", () => {
    const signals = buildComputedSignals({
      data: data({ accounts: [account({ balance: 1000 })], recurring: [recurring()] }),
      now: NOW,
    });

    const cashflow = signals.find((signal) => signal.kind === "cashflow");
    expect(cashflow?.severity).toBe("critical");
    // Money running out is not something the user gets to hide from.
    expect(cashflow?.dismissible).toBe(false);
    expect(cashflow?.evidence).toContain("Liquid now");
  });

  it("ranks a looming overdraft above an over-budget month", () => {
    const signals = buildComputedSignals({
      data: data({
        accounts: [account({ balance: 1000 })],
        recurring: [recurring()],
        expenses: [expense({ amount: 50000 })],
        budgets: { monthlyBudget: 10000, categoryBudgets: {} },
      }),
      now: NOW,
    });
    expect(signals[0].kind).toBe("cashflow");
  });

  it("flags a renewal inside three days but not one further out", () => {
    const near = buildComputedSignals({
      data: data({ subscriptions: [subscription({ nextRenewalDate: "2026-07-22" })] }),
      now: NOW,
    });
    expect(near.some((signal) => signal.kind === "renewal")).toBe(true);

    const far = buildComputedSignals({
      data: data({ subscriptions: [subscription({ nextRenewalDate: "2026-08-15" })] }),
      now: NOW,
    });
    expect(far.some((signal) => signal.kind === "renewal")).toBe(false);
  });

  it("drops dismissed signals but keeps undismissable ones", () => {
    const input = data({
      accounts: [account({ balance: 1000 })],
      recurring: [recurring()],
      subscriptions: [subscription()],
    });
    const all = buildComputedSignals({ data: input, now: NOW });
    const renewal = all.find((signal) => signal.kind === "renewal");
    const cashflow = all.find((signal) => signal.kind === "cashflow");
    expect(renewal && cashflow).toBeTruthy();

    const after = buildComputedSignals({
      data: input,
      now: NOW,
      dismissed: [renewal!.id, cashflow!.id],
    });
    expect(after.some((signal) => signal.id === renewal!.id)).toBe(false);
    expect(after.some((signal) => signal.id === cashflow!.id)).toBe(true);
  });

  it("keeps a dismissed cash-flow signal dismissed only until the date moves", () => {
    // The id carries the date, so a *new* predicted overdraft is a new signal.
    const first = buildComputedSignals({
      data: data({ accounts: [account({ balance: 1000 })], recurring: [recurring()] }),
      now: NOW,
    })[0];
    const later = buildComputedSignals({
      data: data({
        accounts: [account({ balance: 1000 })],
        recurring: [recurring({ dayOfMonth: 15 })],
      }),
      now: NOW,
    })[0];
    expect(first.id).not.toBe(later.id);
  });

  it("marks every computed signal as computed, never as model output", () => {
    const signals = buildComputedSignals({
      data: data({
        accounts: [account({ balance: 1000 })],
        recurring: [recurring()],
        subscriptions: [subscription()],
      }),
      now: NOW,
    });
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((signal) => signal.source === "computed")).toBe(true);
  });
});

describe("computedHeadline", () => {
  it("falls back to spend when no budget is set", () => {
    const line = computedHeadline(data({ expenses: [expense()] }), NOW);
    expect(line).toContain("spent so far this month");
  });

  it("reports what is left against a budget", () => {
    const line = computedHeadline(
      data({ expenses: [expense()], budgets: { monthlyBudget: 10000, categoryBudgets: {} } }),
      NOW,
    );
    expect(line).toContain("left to spend");
  });
});
