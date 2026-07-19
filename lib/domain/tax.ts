import type { Account, Expense } from "./types";
import { isIncome, isInvestment, isSpend } from "./transactions";
import { financialYearRange, inRange } from "./time-ranges";
import { roundMoney } from "./money";

/**
 * Tax-pack shaping for the Indian financial year: everything a CA asks
 * for in February, exported as one structured CSV. Deduction candidates
 * are tag-driven — tag expenses `80c`, `80d`, `80g`, `hra`, or `tax`.
 */

export const DEDUCTION_TAGS = ["80c", "80d", "80g", "80ccd", "hra", "tax"];

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvRow(cells: (string | number)[]): string {
  return cells
    .map((cell) =>
      typeof cell === "number" ? String(cell) : csvEscape(cell),
    )
    .join(",");
}

export interface TaxPackInput {
  expenses: Expense[];
  accounts: Account[];
  yearsBack?: 0 | 1;
  today?: string;
}

export function buildTaxPackCsv({
  expenses,
  accounts,
  yearsBack = 0,
  today,
}: TaxPackInput): { csv: string; label: string; fileName: string } {
  const reference = today ?? new Date().toISOString().slice(0, 10);
  const fy = financialYearRange(reference, yearsBack);
  const range = { start: fy.start, end: fy.end };
  const accountName = (id: string | undefined) =>
    accounts.find((account) => account.id === id)?.name ?? "";
  const rows = expenses.filter((expense) => inRange(expense.date, range));

  const lines: string[] = [];
  lines.push(`Ledger tax pack,${fy.label} (${fy.start} to ${fy.end})`);
  lines.push("");

  // Income
  const income = rows
    .filter(isIncome)
    .sort((a, b) => a.date.localeCompare(b.date));
  lines.push("INCOME");
  lines.push(csvRow(["Date", "Description", "Category", "Source", "Account", "Amount"]));
  for (const row of income) {
    lines.push(
      csvRow([
        row.date,
        row.description,
        row.incomeCategory ?? "Other",
        row.source ?? "",
        accountName(row.accountId),
        row.amount,
      ]),
    );
  }
  lines.push(
    csvRow([
      "TOTAL", "", "", "", "",
      roundMoney(income.reduce((sum, row) => sum + row.amount, 0)),
    ]),
  );
  lines.push("");

  // Deduction-tagged expenses
  const deductions = rows.filter(
    (row) =>
      isSpend(row) &&
      row.tags.some((tag) => DEDUCTION_TAGS.includes(tag.toLowerCase())),
  );
  lines.push("DEDUCTION-TAGGED EXPENSES (tags: " + DEDUCTION_TAGS.join(" ") + ")");
  lines.push(csvRow(["Date", "Description", "Tags", "Account", "Amount"]));
  for (const row of deductions) {
    lines.push(
      csvRow([
        row.date,
        row.description,
        row.tags.join(" | "),
        accountName(row.accountId),
        row.amount,
      ]),
    );
  }
  lines.push(
    csvRow([
      "TOTAL", "", "", "",
      roundMoney(deductions.reduce((sum, row) => sum + row.amount, 0)),
    ]),
  );
  lines.push("");

  // Investment transactions (SIP proofs, 80C candidates, capital events)
  const investments = rows
    .filter(isInvestment)
    .sort((a, b) => a.date.localeCompare(b.date));
  lines.push("INVESTMENT TRANSACTIONS");
  lines.push(
    csvRow(["Date", "Description", "From account", "Into holding", "Units", "Amount"]),
  );
  for (const row of investments) {
    lines.push(
      csvRow([
        row.date,
        row.description,
        accountName(row.accountId),
        accountName(row.transferAccountId),
        row.units ?? "",
        row.amount,
      ]),
    );
  }
  lines.push(
    csvRow([
      "TOTAL", "", "", "", "",
      roundMoney(investments.reduce((sum, row) => sum + row.amount, 0)),
    ]),
  );
  lines.push("");

  // Spending by category — context for the return, not deductions.
  lines.push("SPENDING BY CATEGORY");
  lines.push(csvRow(["Category", "Amount"]));
  const byCategory = new Map<string, number>();
  for (const row of rows.filter(isSpend)) {
    byCategory.set(
      row.category,
      roundMoney((byCategory.get(row.category) ?? 0) + row.amount),
    );
  }
  for (const [category, total] of [...byCategory.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    lines.push(csvRow([category, total]));
  }

  return {
    csv: lines.join("\n"),
    label: fy.label,
    fileName: `ledger-tax-pack-${fy.label.replace(/\s+/g, "-").toLowerCase()}.csv`,
  };
}
