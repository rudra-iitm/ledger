import type { Expense } from "../types";
import { resolveBrand } from "../../brands/registry";
import type { StatementRow } from "./csv";

/**
 * Duplicate detection between statement rows and ledger expenses.
 * Scores in [0, 1]: ≥ AUTO_MERGE_THRESHOLD merges silently (statement
 * enriches the manual row), ≥ REVIEW_THRESHOLD asks the user, below is new.
 */
export const AUTO_MERGE_THRESHOLD = 0.9;
export const REVIEW_THRESHOLD = 0.6;

const DATE_WINDOW_DAYS = 4;

function dayDifference(a: string, b: string): number {
  const ms = Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`));
  return Math.round(ms / 86_400_000);
}

function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let overlap = 0;
  for (const token of setA) if (setB.has(token)) overlap += 1;
  return overlap / (setA.size + setB.size - overlap);
}

function amountTolerance(amount: number): number {
  return Math.max(1, amount * 0.005);
}

/** Whether a ledger row could plausibly be this statement line. */
export function isCompatible(
  row: StatementRow,
  expense: Expense,
  accountId: string,
): boolean {
  if (expense.provenance?.some((source) => source.kind === "statement")) {
    return false;
  }
  const type = expense.type ?? "expense";
  if (row.direction === "debit") {
    const outflow =
      type === "expense" ||
      type === "transfer" ||
      type === "cc_payment" ||
      type === "investment";
    if (!outflow) return false;
    return expense.accountId === accountId || expense.accountId === undefined;
  }
  if (type === "income") {
    return expense.accountId === accountId || expense.accountId === undefined;
  }
  if (type === "transfer") return expense.transferAccountId === accountId;
  if (type === "cc_payment") return expense.paymentTargetId === accountId;
  return false;
}

/** Score one row/expense pair. Reference-number equality short-circuits to 1. */
export function scoreMatch(row: StatementRow, expense: Expense): number {
  if (
    row.refNo &&
    expense.provenance?.some((source) => source.refNo && source.refNo === row.refNo)
  ) {
    return 1;
  }

  const amountDiff = Math.abs(expense.amount - row.amount);
  if (amountDiff > amountTolerance(row.amount)) return 0;
  const amountScore = amountDiff < 0.005 ? 0.35 : 0.25;

  const days = dayDifference(row.date, expense.date);
  if (days > DATE_WINDOW_DAYS) return 0;
  const dateScore = 0.25 * (1 - days / (DATE_WINDOW_DAYS + 1));

  const rowBrand = resolveBrand(row.description);
  const expenseBrand = resolveBrand(
    `${expense.description} ${expense.notes ?? ""}`,
  );
  let textScore: number;
  if (rowBrand && expenseBrand && rowBrand.id === expenseBrand.id) {
    textScore = 0.35;
  } else {
    textScore =
      0.35 *
      jaccard(normalizeText(row.description), normalizeText(expense.description));
  }

  const categoryScore =
    rowBrand && rowBrand.category === expense.category ? 0.1 : 0;

  return Math.min(1, amountScore + dateScore + textScore + categoryScore);
}

export interface RowMatch {
  rowIndex: number;
  expense: Expense;
  score: number;
}

/**
 * Greedy one-to-one assignment of statement rows to ledger candidates,
 * best scores first, so one manual entry can never absorb two lines.
 */
export function matchRows(
  rows: StatementRow[],
  expenses: Expense[],
  accountId: string,
): Map<number, RowMatch> {
  const pairs: RowMatch[] = [];
  rows.forEach((row, rowIndex) => {
    for (const expense of expenses) {
      if (!isCompatible(row, expense, accountId)) continue;
      const score = scoreMatch(row, expense);
      if (score >= REVIEW_THRESHOLD) pairs.push({ rowIndex, expense, score });
    }
  });
  pairs.sort((a, b) => b.score - a.score);
  const byRow = new Map<number, RowMatch>();
  const claimedExpenses = new Set<string>();
  for (const pair of pairs) {
    if (byRow.has(pair.rowIndex) || claimedExpenses.has(pair.expense.id)) continue;
    byRow.set(pair.rowIndex, pair);
    claimedExpenses.add(pair.expense.id);
  }
  return byRow;
}
