import { describe, expect, it } from "vitest";
import type {
  Account,
  RecurringExpense,
  RecurringInvestment,
  Subscription,
} from "@/lib/domain/types";
import { projectCashFlow } from "@/lib/domain/forecast";

const NOW = new Date(2026, 6, 19); // 19 Jul 2026, local time

function account(overrides: Partial<Account>): Account {
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

function recurring(overrides: Partial<RecurringExpense>): RecurringExpense {
  return {
    id: "rec-1",
    description: "Rent",
    amount: 5000,
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

describe("projectCashFlow", () => {
  it("produces a point per day and starts from the liquid balance", () => {
    const forecast = projectCashFlow(
      {
        accounts: [account({})],
        recurring: [],
        subscriptions: [],
        recurringInvestments: [],
      },
      90,
      NOW,
    );
    expect(forecast.start).toBe(10000);
    expect(forecast.points).toHaveLength(91);
    expect(forecast.points[0].date).toBe("2026-07-19");
    expect(forecast.points.at(-1)?.balance).toBe(10000);
    expect(forecast.firstNegative).toBeNull();
  });

  it("walks recurring expenses and income through the horizon", () => {
    const forecast = projectCashFlow(
      {
        accounts: [account({})],
        recurring: [
          recurring({}), // rent 5000 on Aug 1, Sep 1, Oct 1
          recurring({
            id: "rec-2",
            description: "Salary",
            kind: "income",
            amount: 20000,
            dayOfMonth: 25,
            lastMaterializedDate: "2026-06-25",
          }),
        ],
        subscriptions: [],
        recurringInvestments: [],
      },
      90,
      NOW,
    );
    // Jul 25 +20000, Aug 1 −5000, Aug 25 +20000, Sep 1 −5000, Sep 25 +20000, Oct 1 −5000
    expect(forecast.totalIn).toBe(60000);
    expect(forecast.totalOut).toBe(15000);
    expect(forecast.points.at(-1)?.balance).toBe(10000 + 60000 - 15000);
  });

  it("flags the first projected negative day", () => {
    const forecast = projectCashFlow(
      {
        accounts: [account({ balance: 1000 })],
        recurring: [recurring({ amount: 8000 })],
        subscriptions: [],
        recurringInvestments: [],
      },
      90,
      NOW,
    );
    expect(forecast.firstNegative?.date).toBe("2026-08-01");
    expect(forecast.lowest.balance).toBe(1000 - 8000 * 3);
  });

  it("ignores transfers between two liquid accounts but counts boundary crossings", () => {
    const cash = account({ id: "acc-cash", type: "cash", balance: 0 });
    const invest = account({
      id: "acc-inv",
      type: "investment",
      balance: 0,
    });
    const internal = recurring({
      id: "t1",
      kind: "transfer",
      transferAccountId: "acc-cash",
      amount: 100,
    });
    const outbound = recurring({
      id: "t2",
      kind: "transfer",
      transferAccountId: "acc-inv",
      amount: 200,
    });
    const forecast = projectCashFlow(
      {
        accounts: [account({}), cash, invest],
        recurring: [internal, outbound],
        subscriptions: [],
        recurringInvestments: [],
      },
      90,
      NOW,
    );
    expect(forecast.totalOut).toBe(600); // only the investment leg × 3 months
  });

  it("counts subscriptions, SIPs (affectsBalance only), and CC dues", () => {
    const subscription: Subscription = {
      id: "sub-1",
      name: "Netflix",
      amount: 649,
      billingCycle: "monthly",
      category: "Bills",
      nextRenewalDate: "2026-07-20",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const sip: RecurringInvestment = {
      id: "sip-1",
      name: "Index SIP",
      assetType: "mutual_fund",
      amount: 3000,
      fromAccountId: "acc-bank",
      investmentAccountId: "acc-inv",
      frequency: "monthly",
      dayOfMonth: 5,
      startDate: "2026-01-05",
      lastMaterializedDate: "2026-07-05",
      affectsBalance: true,
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const externalSip: RecurringInvestment = {
      ...sip,
      id: "sip-2",
      affectsBalance: false,
    };
    const card = account({
      id: "acc-card",
      type: "credit_card",
      balance: 4000,
      statementDueDate: "2026-07-28",
      minimumDue: 500,
    });
    const forecast = projectCashFlow(
      {
        accounts: [account({}), card],
        recurring: [],
        subscriptions: [subscription],
        recurringInvestments: [sip, externalSip],
      },
      90,
      NOW,
    );
    // Netflix: Jul 20, Aug 20, Sep 20, Oct 17 (drift) → within horizon ×3or4
    // SIP: Aug 5, Sep 5, Oct 5 ×3000; card min due 500 once. External SIP: 0.
    expect(forecast.totalOut).toBeGreaterThanOrEqual(649 * 3 + 3000 * 3 + 500);
    expect(forecast.totalOut).toBeLessThanOrEqual(649 * 4 + 3000 * 3 + 500);
  });
});
