import { describe, expect, it } from "vitest";
import {
  allocationByClass,
  assetClassOf,
  concentration,
  idleCash,
  monthlyContribution,
  priceCoverage,
  projectNetWorth,
  wealthReport,
} from "@/lib/domain/wealth";
import { buildPortfolio } from "@/lib/domain/investments";
import type { Account, Expense, RecurringInvestment, Snapshot } from "@/lib/domain/types";

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "inv-1",
    name: "Nifty Index",
    type: "investment",
    balance: 10000,
    openingBalance: 0,
    icon: "📈",
    archived: false,
    debitCards: [],
    reconciliations: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** An investment buy: units land on the row, money on the account. */
function buy(accountId: string, units: number, id = "e1"): Expense {
  return {
    id,
    description: "SIP",
    amount: 1000,
    category: "Investments",
    date: "2026-01-05",
    createdAt: "2026-01-05T00:00:00.000Z",
    type: "investment",
    transferAccountId: accountId,
    units,
  } as Expense;
}

function snapshot(month: string, netWorth: number): Snapshot {
  return {
    month,
    capturedAt: `${month}-01T00:00:00.000Z`,
    netWorth,
    assetsTotal: netWorth,
    liabilitiesTotal: 0,
    invested: 0,
    portfolioValue: 0,
    accounts: [],
  };
}

function sip(overrides: Partial<RecurringInvestment> = {}): RecurringInvestment {
  return {
    id: "sip-1",
    name: "Monthly SIP",
    assetType: "mutual_fund",
    amount: 5000,
    fromAccountId: "acc-bank",
    investmentAccountId: "inv-1",
    frequency: "monthly",
    dayOfMonth: 1,
    startDate: "2026-01-01",
    affectsBalance: true,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("asset classes", () => {
  it("treats every equity wrapper as one class", () => {
    // The whole point: three ways to own equity is not diversification.
    for (const type of ["mutual_fund", "etf", "stock", "sip"] as const) {
      expect(assetClassOf(type)).toBe("equity");
    }
  });

  it("keeps commodities, crypto and unknowns apart", () => {
    expect(assetClassOf("gold")).toBe("commodity");
    expect(assetClassOf("silver")).toBe("commodity");
    expect(assetClassOf("crypto")).toBe("crypto");
    expect(assetClassOf(undefined)).toBe("other");
  });
});

describe("allocationByClass", () => {
  it("collapses equity wrappers into a single slice", () => {
    const accounts = [
      account({ id: "a", assetType: "etf", balance: 6000, currentPrice: 10 }),
      account({ id: "b", assetType: "stock", balance: 4000, currentPrice: 10 }),
      account({ id: "c", assetType: "gold", balance: 10000, currentPrice: 10 }),
    ];
    const rows = [buy("a", 600, "e1"), buy("b", 400, "e2"), buy("c", 1000, "e3")];

    const slices = allocationByClass(buildPortfolio(accounts, rows));

    expect(slices).toHaveLength(2);
    const equity = slices.find((slice) => slice.assetClass === "equity");
    expect(equity?.holdings).toBe(2);
    expect(equity?.value).toBe(10000);
    expect(equity?.share).toBeCloseTo(0.5, 5);
  });

  it("is empty for an empty portfolio", () => {
    expect(allocationByClass(buildPortfolio([], []))).toEqual([]);
  });
});

describe("concentration", () => {
  it("reports the dominant holding and its share", () => {
    const accounts = [
      account({ id: "big", assetType: "stock", balance: 9000, currentPrice: 1 }),
      account({ id: "small", assetType: "gold", balance: 1000, currentPrice: 1 }),
    ];
    const rows = [buy("big", 9000, "e1"), buy("small", 1000, "e2")];

    const result = concentration(buildPortfolio(accounts, rows));

    expect(result.topHolding?.account.id).toBe("big");
    expect(result.topHoldingShare).toBeCloseTo(0.9, 5);
    expect(result.topClassShare).toBeCloseTo(0.9, 5);
  });

  it("counts equal holdings as effectively that many", () => {
    const accounts = [1, 2, 3, 4].map((n) =>
      account({ id: `a${n}`, assetType: "stock", balance: 2500, currentPrice: 1 }),
    );
    const rows = accounts.map((acc, i) => buy(acc.id, 2500, `e${i}`));

    const result = concentration(buildPortfolio(accounts, rows));

    expect(result.effectiveHoldings).toBeCloseTo(4, 5);
    expect(result.herfindahl).toBeCloseTo(0.25, 5);
  });

  it("returns a zeroed result rather than dividing by zero when empty", () => {
    const result = concentration(buildPortfolio([], []));
    expect(result.topHolding).toBeNull();
    expect(result.herfindahl).toBe(0);
    expect(result.effectiveHoldings).toBe(0);
  });
});

describe("priceCoverage", () => {
  it("separates market value from value carried at cost", () => {
    const accounts = [
      account({ id: "priced", assetType: "etf", balance: 5000, currentPrice: 2 }),
      account({ id: "unpriced", assetType: "other", balance: 5000 }),
    ];
    const rows = [buy("priced", 2500, "e1"), buy("unpriced", 100, "e2")];

    const coverage = priceCoverage(buildPortfolio(accounts, rows));

    expect(coverage.pricedShare).toBeCloseTo(0.5, 5);
    expect(coverage.unpricedAccounts.map((a) => a.id)).toEqual(["unpriced"]);
  });

  it("calls an empty portfolio fully covered rather than zero", () => {
    // Nothing unpriced is not the same as nothing known — an empty portfolio
    // must not raise a "we can't price your holdings" warning.
    expect(priceCoverage(buildPortfolio([], [])).pricedShare).toBe(1);
  });
});

describe("monthlyContribution", () => {
  it("normalises every frequency to a month", () => {
    expect(monthlyContribution(sip({ frequency: "monthly", amount: 5000 }))).toBe(5000);
    expect(monthlyContribution(sip({ frequency: "quarterly", amount: 3000 }))).toBe(1000);
    expect(monthlyContribution(sip({ frequency: "yearly", amount: 12000 }))).toBe(1000);
    expect(monthlyContribution(sip({ frequency: "daily", amount: 100 }))).toBe(3000);
  });

  it("uses 52/12 weeks, not 4, so a year doesn't lose a month", () => {
    // 4 weeks/month would under-count by a full contribution every year.
    expect(monthlyContribution(sip({ frequency: "weekly", amount: 1200 }))).toBeCloseTo(5200, 5);
  });
});

describe("projectNetWorth", () => {
  const accounts = [account({ id: "bank", type: "bank", balance: 100000 })];

  it("says nothing when there is neither history nor a schedule", () => {
    const projection = projectNetWorth({ accounts, snapshots: [], recurringInvestments: [] });
    expect(projection.basis).toBe("none");
    expect(projection.projected).toBe(projection.current);
  });

  it("falls back to committed contributions when there is no history", () => {
    const projection = projectNetWorth({
      accounts,
      snapshots: [],
      recurringInvestments: [sip({ amount: 5000 })],
    });
    expect(projection.basis).toBe("contributions");
    expect(projection.monthlyChange).toBe(5000);
    expect(projection.projected).toBe(100000 + 5000 * 12);
  });

  it("refuses to call two snapshots a trend", () => {
    const projection = projectNetWorth({
      accounts,
      snapshots: [snapshot("2026-05", 10000), snapshot("2026-06", 20000)],
      recurringInvestments: [sip({ amount: 5000 })],
    });
    expect(projection.basis).toBe("contributions");
  });

  it("averages real month-over-month change once there is enough history", () => {
    const projection = projectNetWorth({
      accounts,
      snapshots: [
        snapshot("2026-04", 100000),
        snapshot("2026-05", 110000),
        snapshot("2026-06", 130000),
      ],
      recurringInvestments: [],
    });
    // (130000 - 100000) / 2 spans = 15000/month
    expect(projection.basis).toBe("trend");
    expect(projection.monthlyChange).toBe(15000);
    expect(projection.projected).toBe(100000 + 15000 * 12);
  });

  it("does not add SIPs on top of a trend that already contains them", () => {
    const withSip = projectNetWorth({
      accounts,
      snapshots: [
        snapshot("2026-04", 100000),
        snapshot("2026-05", 110000),
        snapshot("2026-06", 120000),
      ],
      recurringInvestments: [sip({ amount: 5000 })],
    });
    // Double-counting here would inflate every projection by the exact amount
    // the user is proudest of.
    expect(withSip.monthlyChange).toBe(10000);
    expect(withSip.scheduledContribution).toBe(5000);
  });

  it("projects a decline honestly", () => {
    const projection = projectNetWorth({
      accounts,
      snapshots: [
        snapshot("2026-04", 200000),
        snapshot("2026-05", 180000),
        snapshot("2026-06", 160000),
      ],
      recurringInvestments: [],
    });
    expect(projection.monthlyChange).toBe(-20000);
    expect(projection.projected).toBeLessThan(projection.current);
  });

  it("ignores an inactive schedule", () => {
    const projection = projectNetWorth({
      accounts,
      snapshots: [],
      recurringInvestments: [sip({ active: false })],
    });
    expect(projection.basis).toBe("none");
  });
});

describe("idleCash", () => {
  it("reports only the excess over a buffer of the user's own outgoings", () => {
    const accounts = [
      account({ id: "bank", type: "bank", balance: 500000 }),
      account({ id: "inv", type: "investment", balance: 999999 }),
    ];
    const result = idleCash(accounts, 30000);
    expect(result.liquid).toBe(500000); // investments are not liquid
    expect(result.buffer).toBe(180000);
    expect(result.excess).toBe(320000);
  });

  it("never reports negative idle cash", () => {
    const accounts = [account({ id: "bank", type: "bank", balance: 10000 })];
    expect(idleCash(accounts, 30000).excess).toBe(0);
  });
});

describe("wealthReport", () => {
  it("assembles one consistent picture", () => {
    const accounts = [
      account({ id: "bank", type: "bank", balance: 50000 }),
      account({ id: "inv", assetType: "etf", balance: 10000, currentPrice: 2 }),
      account({ id: "card", type: "credit_card", balance: -5000 }),
    ];
    const report = wealthReport({
      accounts,
      expenses: [buy("inv", 5000)],
      snapshots: [],
      recurringInvestments: [],
    });

    expect(report.netWorth).toBe(report.assets - report.liabilities);
    expect(report.portfolio.holdings).toHaveLength(1);
    expect(report.allocation[0].assetClass).toBe("equity");
    expect(report.coverage.pricedShare).toBe(1);
  });
});
