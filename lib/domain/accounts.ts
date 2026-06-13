import type { Account, AccountType, Expense } from "./types";
import { currentMonth, monthOf } from "./dates";
import { roundMoney } from "./money";
import { isSpend } from "./transactions";

export function accountExpenses(
  expenses: Expense[],
  accountId: string,
): Expense[] {
  return expenses.filter((expense) => expense.accountId === accountId);
}

export interface AccountSummary {
  balance: number;
  monthlySpending: number;
  totalTransactions: number;
  totalSpending: number;
}

export function accountSummary(
  expenses: Expense[],
  account: Account,
  month: string = currentMonth(),
): AccountSummary {
  const owned = accountExpenses(expenses, account.id);
  const spend = owned.filter(isSpend);
  const monthlySpending = roundMoney(
    spend
      .filter((expense) => monthOf(expense.date) === month)
      .reduce((total, expense) => total + expense.amount, 0),
  );
  const totalSpending = roundMoney(
    spend.reduce((total, expense) => total + expense.amount, 0),
  );
  return {
    balance: account.balance,
    monthlySpending,
    totalTransactions: owned.length,
    totalSpending,
  };
}

export interface AccountTypeSpend {
  type: AccountType;
  total: number;
}

export function spendingByAccountType(
  expenses: Expense[],
  accounts: Account[],
): AccountTypeSpend[] {
  const typeById = new Map(accounts.map((account) => [account.id, account.type]));
  const totals = new Map<AccountType, number>();
  for (const expense of expenses) {
    if (!isSpend(expense)) continue;
    if (!expense.accountId) continue;
    const type = typeById.get(expense.accountId);
    if (!type) continue;
    totals.set(type, (totals.get(type) ?? 0) + expense.amount);
  }
  return Array.from(totals, ([type, total]) => ({
    type,
    total: roundMoney(total),
  })).sort((a, b) => b.total - a.total);
}

export function rankAccountsBySpending(
  expenses: Expense[],
  accounts: Account[],
  month: string = currentMonth(),
): Array<{ account: Account; spent: number }> {
  return accounts
    .map((account) => ({
      account,
      spent: accountSummary(expenses, account, month).monthlySpending,
    }))
    .filter((entry) => entry.spent > 0)
    .sort((a, b) => b.spent - a.spent);
}
