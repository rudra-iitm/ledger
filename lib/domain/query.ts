/**
 * The ledger query language.
 *
 * This is the contract that keeps AI answers honest. A model never reports a
 * number; it emits a `LedgerQuery`, this module executes it against the real
 * ledger, and the model narrates the result. Three properties fall out:
 *
 *  - **auditable** — every answer reduces to a filter the user can open in the
 *    expenses screen and verify row by row;
 *  - **cheap** — the question and the schema go over the wire, not five years
 *    of transactions;
 *  - **reproducible** — the same query always yields the same numbers, so a
 *    follow-up ("only December", "by month") is a query edit, not a re-roll.
 *
 * Pure by construction: no React, no IO, `now` is injected.
 */

import { z } from "zod";
import {
  bucketedTotals,
  breakdownByCategory,
  filterExpenses,
  incomeByCategory,
  incomeTotal,
  totalSpending,
  type BucketPoint,
  type CategoryBreakdown,
  type Granularity,
} from "./analytics";
import { categorySchema, type Account, type Expense, type Space } from "./types";
import {
  resolveRange,
  TIME_PRESET_LABELS,
  TIME_PRESETS,
  type DateRange,
  type TimePreset,
} from "./time-ranges";
import { incomeRows, spendRows } from "./transactions";

export const QUERY_INTENTS = [
  /** The matching transactions themselves. */
  "list",
  /** One number: how much. */
  "total",
  /** Split by category. */
  "breakdown",
  /** A time series. */
  "trend",
  /** This period against another. */
  "compare",
] as const;
export type QueryIntent = (typeof QUERY_INTENTS)[number];

export const ROW_KINDS = ["spend", "income", "all"] as const;
export type RowKind = (typeof ROW_KINDS)[number];

export const GROUPINGS = ["category", "day", "week", "month"] as const;
export type Grouping = (typeof GROUPINGS)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Validation is strict on vocabulary and forgiving on absence: a model that
 * omits a field gets the sensible default, but a model that invents a
 * category or preset is rejected rather than silently coerced.
 */
export const ledgerQuerySchema = z.object({
  intent: z.enum(QUERY_INTENTS).default("total"),
  rows: z.enum(ROW_KINDS).default("spend"),
  preset: z.enum(TIME_PRESETS).default("thisMonth"),
  start: isoDate.optional(),
  end: isoDate.optional(),
  comparePreset: z.enum(TIME_PRESETS).optional(),
  category: categorySchema.optional(),
  accountId: z.string().optional(),
  spaceId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  text: z.string().default(""),
  groupBy: z.enum(GROUPINGS).optional(),
  limit: z.number().int().min(1).max(200).default(25),
});

export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;

export interface QueryInput {
  expenses: Expense[];
  accounts: Account[];
  spaces: Space[];
}

export interface ComparisonResult {
  label: string;
  total: number;
  /** Percent change of the primary period against the comparison period. */
  changePct: number;
}

export interface QueryResult {
  /** Human-readable restatement of what was actually run. */
  label: string;
  intent: QueryIntent;
  rowKind: RowKind;
  range: DateRange;
  count: number;
  total: number;
  /** Capped at `query.limit` — the full count is in `count`. */
  rows: Expense[];
  breakdown?: CategoryBreakdown[];
  series?: BucketPoint[];
  comparison?: ComparisonResult;
  /** The query that produced this, echoed so the UI can offer "open in list". */
  query: LedgerQuery;
}

function ofKind(rows: Expense[], kind: RowKind): Expense[] {
  if (kind === "spend") return spendRows(rows);
  if (kind === "income") return incomeRows(rows);
  return rows;
}

function sumOf(rows: Expense[], kind: RowKind): number {
  if (kind === "income") return incomeTotal(rows);
  if (kind === "spend") return totalSpending(rows);
  return totalSpending(rows) + incomeTotal(rows);
}

/** Pick a bucket size that yields a readable number of points for the range. */
function granularityFor(query: LedgerQuery, range: DateRange, now: Date): Granularity {
  if (query.groupBy === "day") return "day";
  if (query.groupBy === "week") return "week";
  if (query.groupBy === "month") return "month";
  const start = range.start ? new Date(range.start) : null;
  const end = range.end ? new Date(range.end) : now;
  if (!start) return "month";
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

function describe(
  query: LedgerQuery,
  input: QueryInput,
  range: DateRange,
): string {
  const parts: string[] = [];
  if (query.rows === "income") parts.push("Income");
  else if (query.rows === "all") parts.push("All transactions");
  else parts.push("Spending");

  if (query.category) parts.push(`in ${query.category}`);
  if (query.text) parts.push(`matching "${query.text}"`);
  if (query.tags.length) parts.push(`tagged ${query.tags.map((tag) => `#${tag}`).join(" ")}`);

  const account = input.accounts.find((item) => item.id === query.accountId);
  if (account) parts.push(`on ${account.name}`);
  const space = input.spaces.find((item) => item.id === query.spaceId);
  if (space) parts.push(`in ${space.name}`);

  if (query.preset === "custom" && range.start && range.end) {
    parts.push(`from ${range.start} to ${range.end}`);
  } else {
    parts.push(`· ${TIME_PRESET_LABELS[query.preset]}`);
  }
  return parts.join(" ");
}

/** Run a query against the ledger. Never throws on empty data. */
export function executeQuery(
  query: LedgerQuery,
  input: QueryInput,
  now: Date = new Date(),
): QueryResult {
  const range =
    query.preset === "custom"
      ? { start: query.start ?? null, end: query.end ?? null }
      : resolveRange(query.preset, { start: null, end: null }, now);

  const matched = ofKind(
    filterExpenses(input.expenses, {
      range,
      category: query.category ?? null,
      accountId: query.accountId ?? null,
      spaceId: query.spaceId ?? null,
      tags: query.tags,
      query: query.text || undefined,
    }),
    query.rows,
  );

  const total = sumOf(matched, query.rows);
  const sorted = [...matched].sort((a, b) =>
    query.intent === "list" && b.date !== a.date
      ? b.date.localeCompare(a.date)
      : b.amount - a.amount,
  );

  const result: QueryResult = {
    label: describe(query, input, range),
    intent: query.intent,
    rowKind: query.rows,
    range,
    count: matched.length,
    total,
    rows: sorted.slice(0, query.limit),
    query,
  };

  if (query.intent === "breakdown" || query.groupBy === "category") {
    result.breakdown =
      query.rows === "income"
        ? incomeByCategory(matched).map((item) => ({
            category: item.category as unknown as CategoryBreakdown["category"],
            total: item.total,
            count: item.count,
            percentage: item.percentage,
          }))
        : breakdownByCategory(matched);
  }

  if (query.intent === "trend") {
    result.series = bucketedTotals(matched, granularityFor(query, range, now));
  }

  if (query.intent === "compare" && query.comparePreset) {
    const compareRange = resolveRange(
      query.comparePreset,
      { start: null, end: null },
      now,
    );
    const compareRows = ofKind(
      filterExpenses(input.expenses, {
        range: compareRange,
        category: query.category ?? null,
        accountId: query.accountId ?? null,
        spaceId: query.spaceId ?? null,
        tags: query.tags,
        query: query.text || undefined,
      }),
      query.rows,
    );
    const compareTotal = sumOf(compareRows, query.rows);
    result.comparison = {
      label: TIME_PRESET_LABELS[query.comparePreset],
      total: compareTotal,
      changePct:
        compareTotal > 0
          ? Math.round(((total - compareTotal) / compareTotal) * 100)
          : total > 0
            ? 100
            : 0,
    };
  }

  return result;
}

/**
 * Compact the result for a model prompt.
 *
 * Only what is needed to narrate: totals, the shape of the split, and a
 * handful of example rows. Never the whole match set — that is what the
 * "open in list" affordance is for.
 */
export function summariseResult(result: QueryResult, currency: string): string {
  const lines: string[] = [
    `Query: ${result.label}`,
    `Matched ${result.count} transaction(s), total ${currency}${result.total.toFixed(2)}`,
  ];
  if (result.comparison) {
    lines.push(
      `Comparison (${result.comparison.label}): ${currency}${result.comparison.total.toFixed(2)} ` +
        `(${result.comparison.changePct >= 0 ? "+" : ""}${result.comparison.changePct}%)`,
    );
  }
  if (result.breakdown?.length) {
    lines.push(
      "By category: " +
        result.breakdown
          .slice(0, 8)
          .map((item) => `${item.category} ${currency}${item.total.toFixed(0)} (${item.percentage}%)`)
          .join(", "),
    );
  }
  if (result.series?.length) {
    lines.push(
      "Series: " +
        result.series
          .slice(-12)
          .map((point) => `${point.label} ${currency}${point.total.toFixed(0)}`)
          .join(", "),
    );
  }
  if (result.rows.length) {
    lines.push(
      "Top rows: " +
        result.rows
          .slice(0, 8)
          .map((row) => `${row.date} ${row.description} ${currency}${row.amount.toFixed(0)}`)
          .join(" | "),
    );
  }
  return lines.join("\n");
}
