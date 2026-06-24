import type { Expense } from "./types";

export function isSpend(row: Expense): boolean {
  return (row.type ?? "expense") === "expense";
}

export function isIncome(row: Expense): boolean {
  return row.type === "income";
}

export function isInvestment(row: Expense): boolean {
  return row.type === "investment";
}

export function visibleInExpenseList(
  rows: Expense[],
  showInvestments: boolean,
): Expense[] {
  if (showInvestments) return rows;
  return rows.filter((row) => !isInvestment(row));
}

export function spendRows(rows: Expense[]): Expense[] {
  return rows.filter(isSpend);
}

export function incomeRows(rows: Expense[]): Expense[] {
  return rows.filter(isIncome);
}
