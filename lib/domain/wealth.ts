/**
 * Wealth analysis — allocation, concentration, coverage and projection.
 *
 * The investments screen could already tell you what you own and what it's
 * worth. What it couldn't tell you is whether that shape is *sensible*: that
 * 70% of your money sits in one fund, that a third of your "current value" is
 * really just what you paid because nothing ever priced it, or where your net
 * worth lands in a year if nothing changes.
 *
 * Everything here is pure and deterministic. No model touches these numbers —
 * consistent with the rest of `lib/domain`, and doubly important here, because
 * these are the figures someone might make an actual investment decision on.
 *
 * Two honesty rules run through the whole module:
 *
 *  1. **Never imply precision we don't have.** A holding with no live price is
 *     carried at cost, and `pricedShare` says exactly how much of the portfolio
 *     that applies to. A projection built on two data points says so.
 *  2. **Describe, don't advise.** We report that one holding is 68% of the
 *     portfolio. We do not tell anyone to sell it. Ledger is not a licensed
 *     adviser and must never read like one.
 */

import { assetsTotal, liabilitiesTotal, netWorth } from "./balances";
import { isLiquid } from "./forecast";
import { buildPortfolio, type Holding, type Portfolio } from "./investments";
import { roundMoney } from "./money";
import type {
  Account,
  AssetType,
  Expense,
  RecurringInvestment,
  Snapshot,
} from "./types";

/* ------------------------------------------------------------------ */
/* Asset classes                                                      */
/* ------------------------------------------------------------------ */

/**
 * Asset *classes*, not asset types.
 *
 * A user holding an ETF, a mutual fund and a SIP does not hold three
 * different things — they hold equity three ways. Concentration measured on
 * the raw `AssetType` would call that a diversified portfolio, which is the
 * opposite of true and the exact mistake this module exists to catch.
 */
export const ASSET_CLASSES = ["equity", "commodity", "crypto", "other"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity: "Equity",
  commodity: "Commodity",
  crypto: "Crypto",
  other: "Other",
};

const CLASS_OF: Record<AssetType, AssetClass> = {
  mutual_fund: "equity",
  etf: "equity",
  stock: "equity",
  sip: "equity",
  gold: "commodity",
  silver: "commodity",
  crypto: "crypto",
  other: "other",
};

export function assetClassOf(assetType: AssetType | undefined): AssetClass {
  return assetType ? CLASS_OF[assetType] : "other";
}

/* ------------------------------------------------------------------ */
/* Allocation                                                         */
/* ------------------------------------------------------------------ */

export interface AllocationSlice {
  assetClass: AssetClass;
  label: string;
  value: number;
  /** 0–1 of the invested portfolio. */
  share: number;
  holdings: number;
}

/** Portfolio split by asset class, largest first. Empty classes are omitted. */
export function allocationByClass(portfolio: Portfolio): AllocationSlice[] {
  const totals = new Map<AssetClass, { value: number; holdings: number }>();

  for (const holding of portfolio.holdings) {
    const key = assetClassOf(holding.account.assetType);
    const current = totals.get(key) ?? { value: 0, holdings: 0 };
    current.value += holding.currentValue;
    current.holdings += 1;
    totals.set(key, current);
  }

  const total = portfolio.currentValue;
  return [...totals.entries()]
    .map(([assetClass, entry]) => ({
      assetClass,
      label: ASSET_CLASS_LABELS[assetClass],
      value: roundMoney(entry.value),
      share: total > 0 ? entry.value / total : 0,
      holdings: entry.holdings,
    }))
    .sort((a, b) => b.value - a.value);
}

/* ------------------------------------------------------------------ */
/* Concentration                                                      */
/* ------------------------------------------------------------------ */

export interface Concentration {
  /** The single biggest holding, and what fraction of the portfolio it is. */
  topHolding: Holding | null;
  topHoldingShare: number;
  topClass: AllocationSlice | null;
  topClassShare: number;
  /**
   * Herfindahl index over holdings (sum of squared shares), 0–1.
   * 1 means everything is in one holding; 0.1 means roughly ten equal ones.
   * Reported rather than graded — the "right" number depends on goals we
   * don't know.
   */
  herfindahl: number;
  /** Effective number of holdings: 1/HHI. More intuitive than the index. */
  effectiveHoldings: number;
}

export function concentration(portfolio: Portfolio): Concentration {
  const total = portfolio.currentValue;
  const slices = allocationByClass(portfolio);

  if (total <= 0 || portfolio.holdings.length === 0) {
    return {
      topHolding: null,
      topHoldingShare: 0,
      topClass: null,
      topClassShare: 0,
      herfindahl: 0,
      effectiveHoldings: 0,
    };
  }

  // `holdings` arrives sorted by currentValue, so the head is the largest.
  const topHolding = portfolio.holdings[0];
  const herfindahl = portfolio.holdings.reduce(
    (sum, holding) => sum + (holding.currentValue / total) ** 2,
    0,
  );

  return {
    topHolding,
    topHoldingShare: topHolding.currentValue / total,
    topClass: slices[0] ?? null,
    topClassShare: slices[0]?.share ?? 0,
    herfindahl,
    effectiveHoldings: herfindahl > 0 ? 1 / herfindahl : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Price coverage                                                     */
/* ------------------------------------------------------------------ */

/**
 * How much of the portfolio's "current value" is actually a market value.
 *
 * `holdingFor` falls back to cost when an account has no `currentPrice`, which
 * is the right default but quietly makes an unpriced portfolio look like it
 * has returned exactly zero. Surfacing the coverage keeps the gain figure
 * honest: "+2.1%" means something different when a third of the money is
 * carried at what you paid for it.
 */
export interface PriceCoverage {
  pricedValue: number;
  unpricedValue: number;
  /** 0–1 of portfolio value backed by a live price. */
  pricedShare: number;
  unpricedAccounts: Account[];
}

export function priceCoverage(portfolio: Portfolio): PriceCoverage {
  let priced = 0;
  let unpriced = 0;
  const unpricedAccounts: Account[] = [];

  for (const holding of portfolio.holdings) {
    const hasPrice = holding.account.currentPrice !== undefined && holding.units > 0;
    if (hasPrice) {
      priced += holding.currentValue;
    } else {
      unpriced += holding.currentValue;
      unpricedAccounts.push(holding.account);
    }
  }

  const total = priced + unpriced;
  return {
    pricedValue: roundMoney(priced),
    unpricedValue: roundMoney(unpriced),
    pricedShare: total > 0 ? priced / total : 1,
    unpricedAccounts,
  };
}

/* ------------------------------------------------------------------ */
/* Net-worth projection                                               */
/* ------------------------------------------------------------------ */

/** Monthly rupee value of a recurring investment schedule. */
export function monthlyContribution(item: RecurringInvestment): number {
  switch (item.frequency) {
    case "daily":
      return item.amount * 30;
    case "weekly":
      // 52/12, not 4 — four weeks a month loses a month's contribution a year.
      return (item.amount * 52) / 12;
    case "monthly":
      return item.amount;
    case "quarterly":
      return item.amount / 3;
    case "yearly":
      return item.amount / 12;
  }
}

export type ProjectionBasis = "trend" | "contributions" | "none";

export interface NetWorthProjection {
  /** Net worth today, from live balances rather than the last snapshot. */
  current: number;
  /** Projected net worth `months` out. */
  projected: number;
  months: number;
  /** Rupees per month the projection is compounding on. */
  monthlyChange: number;
  /** Of `monthlyChange`, the part committed via SIPs. */
  scheduledContribution: number;
  basis: ProjectionBasis;
  /**
   * How many monthly snapshots the trend rests on. Below three we don't claim
   * a trend at all — two points through noise is a straight line to anywhere.
   */
  snapshotsUsed: number;
}

const MIN_SNAPSHOTS_FOR_TREND = 3;

export interface ProjectionInput {
  accounts: Account[];
  snapshots: Snapshot[];
  recurringInvestments: RecurringInvestment[];
}

/**
 * Project net worth forward.
 *
 * Deliberately the dullest possible model: average observed monthly change,
 * floored by what the user has actually committed to investing. No compounding
 * of assumed returns, because assuming a return is how a tracker turns into an
 * unlicensed adviser — and the number people remember is the one that was
 * wrong.
 *
 * Three bases, in descending order of evidence:
 *  - `trend`         — enough snapshots to average real month-over-month change
 *  - `contributions` — no history, but scheduled SIPs are a floor we can stand on
 *  - `none`          — nothing to say; `projected` equals `current`
 */
export function projectNetWorth(
  input: ProjectionInput,
  months = 12,
): NetWorthProjection {
  const current = roundMoney(netWorth(input.accounts));

  const scheduled = roundMoney(
    input.recurringInvestments
      .filter((item) => item.active)
      .reduce((sum, item) => sum + monthlyContribution(item), 0),
  );

  // Chronological, and only the most recent year — a job change two years ago
  // is not evidence about next month.
  const ordered = [...input.snapshots]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-13);

  let monthlyChange = scheduled;
  let basis: ProjectionBasis = scheduled > 0 ? "contributions" : "none";

  if (ordered.length >= MIN_SNAPSHOTS_FOR_TREND) {
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const spans = ordered.length - 1;
    const observed = (last.netWorth - first.netWorth) / spans;
    // The observed trend already contains the contributions, so this replaces
    // rather than adds to them — double-counting a SIP would inflate every
    // projection by exactly the amount the user is proudest of.
    monthlyChange = observed;
    basis = "trend";
  }

  return {
    current,
    projected: roundMoney(current + monthlyChange * months),
    months,
    monthlyChange: roundMoney(monthlyChange),
    scheduledContribution: scheduled,
    basis,
    snapshotsUsed: ordered.length,
  };
}

/* ------------------------------------------------------------------ */
/* Idle cash                                                          */
/* ------------------------------------------------------------------ */

/**
 * Liquid cash beyond a sensible buffer.
 *
 * "Sensible" is defined as six months of the user's own scheduled outgoings
 * rather than a number we invented, and we only report the excess — what to do
 * with it is not ours to say.
 */
export interface IdleCash {
  liquid: number;
  buffer: number;
  excess: number;
}

export function idleCash(
  accounts: Account[],
  monthlyOutgoings: number,
  bufferMonths = 6,
): IdleCash {
  const liquid = roundMoney(
    accounts.filter(isLiquid).reduce((sum, account) => sum + Math.max(0, account.balance), 0),
  );
  const buffer = roundMoney(monthlyOutgoings * bufferMonths);
  return { liquid, buffer, excess: roundMoney(Math.max(0, liquid - buffer)) };
}

/* ------------------------------------------------------------------ */
/* The whole picture                                                  */
/* ------------------------------------------------------------------ */

export interface WealthReport {
  netWorth: number;
  assets: number;
  liabilities: number;
  portfolio: Portfolio;
  allocation: AllocationSlice[];
  concentration: Concentration;
  coverage: PriceCoverage;
  projection: NetWorthProjection;
}

export interface WealthInput {
  accounts: Account[];
  expenses: Expense[];
  snapshots: Snapshot[];
  recurringInvestments: RecurringInvestment[];
}

/** One pass over everything the wealth screen and its signals need. */
export function wealthReport(input: WealthInput, months = 12): WealthReport {
  const portfolio = buildPortfolio(input.accounts, input.expenses);
  return {
    netWorth: roundMoney(netWorth(input.accounts)),
    assets: roundMoney(assetsTotal(input.accounts)),
    liabilities: roundMoney(liabilitiesTotal(input.accounts)),
    portfolio,
    allocation: allocationByClass(portfolio),
    concentration: concentration(portfolio),
    coverage: priceCoverage(portfolio),
    projection: projectNetWorth(input, months),
  };
}
