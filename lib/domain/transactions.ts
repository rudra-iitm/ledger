import type { Expense } from "./types";

export function isSpend(row: Expense): boolean {
  return (row.type ?? "expense") === "expense";
}

export function isIncome(row: Expense): boolean {
  return row.type === "income";
}

export function spendRows(rows: Expense[]): Expense[] {
  return rows.filter(isSpend);
}

export function incomeRows(rows: Expense[]): Expense[] {
  return rows.filter(isIncome);
}
