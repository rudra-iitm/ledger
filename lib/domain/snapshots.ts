import type { Account, Expense, Snapshot } from "./types";
import { assetsTotal, liabilitiesTotal, netWorth } from "./balances";
import { buildPortfolio } from "./investments";
import { currentMonth } from "./dates";
import { roundMoney } from "./money";

const MAX_SNAPSHOTS = 240; // 20 years of months

/** Point-in-time capture of net worth and balances for the current month. */
export function buildSnapshot(
  accounts: Account[],
  expenses: Expense[],
  now: Date = new Date(),
): Snapshot {
  const portfolio = buildPortfolio(accounts, expenses);
  return {
    month: currentMonth(now),
    capturedAt: now.toISOString(),
    netWorth: netWorth(accounts),
    assetsTotal: assetsTotal(accounts),
    liabilitiesTotal: liabilitiesTotal(accounts),
    invested: roundMoney(portfolio.invested),
    portfolioValue: roundMoney(portfolio.currentValue),
    accounts: accounts
      .filter((account) => !account.archived)
      .map((account) => ({ accountId: account.id, balance: account.balance })),
  };
}

/**
 * Upserts the current month's snapshot (months stay fresh until they close),
 * keeps history sorted ascending, and reports whether anything changed —
 * callers should skip persistence when it didn't.
 */
export function upsertSnapshot(
  history: Snapshot[],
  snapshot: Snapshot,
): { history: Snapshot[]; changed: boolean } {
  const existing = history.find((item) => item.month === snapshot.month);
  if (
    existing &&
    existing.netWorth === snapshot.netWorth &&
    existing.assetsTotal === snapshot.assetsTotal &&
    existing.liabilitiesTotal === snapshot.liabilitiesTotal &&
    existing.portfolioValue === snapshot.portfolioValue
  ) {
    return { history, changed: false };
  }
  const next = [
    ...history.filter((item) => item.month !== snapshot.month),
    snapshot,
  ]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-MAX_SNAPSHOTS);
  return { history: next, changed: true };
}
