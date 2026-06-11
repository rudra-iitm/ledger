import type { Account, Expense } from "./types";
import { formatDisplayDate } from "./dates";
import { breakdownByCategory, totalSpending } from "./analytics";

export interface ReportContext {
  accounts: Account[];
  currency: string;
}

function accountLabel(expense: Expense, accounts: Account[]): string {
  if (!expense.accountId) return "";
  return accounts.find((account) => account.id === expense.accountId)?.name ?? "";
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function expensesToCsv(
  expenses: Expense[],
  context: ReportContext,
): string {
  const header = [
    "Date",
    "Description",
    "Category",
    "Amount",
    "Account",
    "Tags",
    "Notes",
  ];
  const rows = expenses.map((expense) => [
    expense.date,
    expense.description,
    expense.category,
    String(expense.amount),
    accountLabel(expense, context.accounts),
    expense.tags.join(" | "),
    expense.notes ?? "",
  ]);
  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
    .join("\n");
}

export interface ReportData {
  title: string;
  generatedFor: string;
  total: number;
  count: number;
  categories: Array<{ category: string; total: number; percentage: number }>;
  rows: Array<{
    date: string;
    description: string;
    category: string;
    amount: number;
  }>;
}

export function buildReportData(
  title: string,
  generatedFor: string,
  expenses: Expense[],
): ReportData {
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  return {
    title,
    generatedFor,
    total: totalSpending(expenses),
    count: expenses.length,
    categories: breakdownByCategory(expenses).map((entry) => ({
      category: entry.category,
      total: entry.total,
      percentage: entry.percentage,
    })),
    rows: sorted.map((expense) => ({
      date: formatDisplayDate(expense.date),
      description: expense.description,
      category: expense.category,
      amount: expense.amount,
    })),
  };
}
