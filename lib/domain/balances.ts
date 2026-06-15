import type { Account, Expense } from "./types";
import { roundMoney } from "./money";

export function isLiability(account: Account): boolean {
  return account.type === "credit_card";
}

export function signedDelta(row: Expense, accountId: string): number {
  const isSource = row.accountId === accountId;
  const isDestination =
    row.transferAccountId === accountId || row.paymentTargetId === accountId;
  if (!isSource && !isDestination) return 0;

  // An investment's holding leg always reflects the asset, even when the
  // purchase doesn't draw from a tracked account (existing/external holdings).
  if (row.type === "investment" && isDestination) return row.amount;

  if (row.affectsBalance === false) return 0;

  switch (row.type) {
    case "income":
      return isSource ? row.amount : 0;
    case "transfer":
    case "cc_payment":
    case "investment":
      if (isSource) return -row.amount;
      if (isDestination) return row.amount;
      return 0;
    case "expense":
    default:
      return isSource ? -row.amount : 0;
  }
}

export function computeBalance(account: Account, rows: Expense[]): number {
  const sign = isLiability(account) ? -1 : 1;
  const delta = rows.reduce((total, row) => {
    if (account.openingDate && row.date < account.openingDate) return total;
    return total + sign * signedDelta(row, account.id);
  }, 0);
  return roundMoney(account.openingBalance + delta);
}

export function recomputeBalances(
  accounts: Account[],
  rows: Expense[],
): Account[] {
  return accounts.map((account) => {
    const balance = computeBalance(account, rows);
    return account.balance === balance ? account : { ...account, balance };
  });
}

export function assetsTotal(accounts: Account[]): number {
  return roundMoney(
    accounts
      .filter((account) => !account.archived && !isLiability(account))
      .reduce((total, account) => total + account.balance, 0),
  );
}

export function liabilitiesTotal(accounts: Account[]): number {
  return roundMoney(
    accounts
      .filter((account) => !account.archived && isLiability(account))
      .reduce((total, account) => total + Math.max(0, account.balance), 0),
  );
}

export function netWorth(accounts: Account[]): number {
  return roundMoney(assetsTotal(accounts) - liabilitiesTotal(accounts));
}

export function availableCredit(account: Account): number | null {
  if (!isLiability(account) || account.creditLimit === undefined) return null;
  return roundMoney(account.creditLimit - Math.max(0, account.balance));
}

export function utilization(account: Account): number | null {
  if (
    !isLiability(account) ||
    account.creditLimit === undefined ||
    account.creditLimit <= 0
  ) {
    return null;
  }
  const used = Math.max(0, account.balance);
  return Math.min(100, Math.round((used / account.creditLimit) * 100));
}

export type StatementStatus = "Unpaid" | "Partially Paid" | "Paid";

export function paymentsToCard(rows: Expense[], cardId: string): Expense[] {
  return rows.filter(
    (row) => row.type === "cc_payment" && row.paymentTargetId === cardId,
  );
}

export function totalPaidToCard(rows: Expense[], cardId: string): number {
  return roundMoney(
    paymentsToCard(rows, cardId).reduce((total, row) => total + row.amount, 0),
  );
}

export function statementStatus(
  account: Account,
  rows: Expense[],
): StatementStatus {
  const statement = account.statementBalance ?? 0;
  if (statement <= 0) return "Paid";
  const paid = paymentsToCard(rows, account.id).reduce(
    (total, row) => total + row.amount,
    0,
  );
  if (paid <= 0) return "Unpaid";
  if (roundMoney(paid) >= roundMoney(statement)) return "Paid";
  return "Partially Paid";
}

export function remainingStatement(account: Account, rows: Expense[]): number {
  const statement = account.statementBalance ?? 0;
  const paid = paymentsToCard(rows, account.id).reduce(
    (total, row) => total + row.amount,
    0,
  );
  return roundMoney(Math.max(0, statement - paid));
}
