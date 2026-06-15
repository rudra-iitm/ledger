import type { Account, Expense, Goal } from "./types";
import { roundMoney } from "./money";

export function isInvestment(row: Expense): boolean {
  return row.type === "investment";
}

export function investmentRows(rows: Expense[], accountId: string): Expense[] {
  return rows.filter(
    (row) => row.type === "investment" && row.transferAccountId === accountId,
  );
}

export interface Holding {
  account: Account;
  invested: number;
  units: number;
  averagePrice: number | null;
  currentValue: number;
  gain: number;
  gainPercent: number;
}

export function holdingFor(account: Account, rows: Expense[]): Holding {
  const owned = investmentRows(rows, account.id);
  const units = roundMoney(
    owned.reduce((total, row) => total + (row.units ?? 0), 0),
  );
  const invested = roundMoney(Math.max(0, account.balance));
  const averagePrice = units > 0 ? roundMoney(invested / units) : null;
  const currentValue =
    account.currentPrice !== undefined && units > 0
      ? roundMoney(units * account.currentPrice)
      : invested;
  const gain = roundMoney(currentValue - invested);
  const gainPercent =
    invested > 0 ? roundMoney((gain / invested) * 100) : 0;
  return {
    account,
    invested,
    units,
    averagePrice,
    currentValue,
    gain,
    gainPercent,
  };
}

export function investmentAccounts(accounts: Account[]): Account[] {
  return accounts.filter(
    (account) => account.type === "investment" && !account.archived,
  );
}

export interface Portfolio {
  invested: number;
  currentValue: number;
  gain: number;
  gainPercent: number;
  holdings: Holding[];
}

export function buildPortfolio(
  accounts: Account[],
  rows: Expense[],
): Portfolio {
  const holdings = investmentAccounts(accounts)
    .map((account) => holdingFor(account, rows))
    .filter((holding) => holding.invested > 0 || holding.units > 0 || holding.currentValue > 0)
    .sort((a, b) => b.currentValue - a.currentValue);
  const invested = roundMoney(
    holdings.reduce((total, holding) => total + holding.invested, 0),
  );
  const currentValue = roundMoney(
    holdings.reduce((total, holding) => total + holding.currentValue, 0),
  );
  const gain = roundMoney(currentValue - invested);
  const gainPercent = invested > 0 ? roundMoney((gain / invested) * 100) : 0;
  return { invested, currentValue, gain, gainPercent, holdings };
}

export interface GoalProgress {
  goal: Goal;
  current: number;
  target: number;
  progress: number;
  remaining: number;
}

export function goalProgress(
  goal: Goal,
  accounts: Account[],
  rows: Expense[],
): GoalProgress {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const current = roundMoney(
    goal.accountIds.reduce((total, id) => {
      const account = byId.get(id);
      if (!account) return total;
      if (account.type === "investment") {
        return total + holdingFor(account, rows).currentValue;
      }
      return total + Math.max(0, account.balance);
    }, 0),
  );
  const target = goal.targetAmount;
  const progress = target > 0 ? Math.min(1, current / target) : 0;
  return {
    goal,
    current,
    target,
    progress,
    remaining: roundMoney(Math.max(0, target - current)),
  };
}
