import { describe, expect, it } from "vitest";
import type { Expense } from "@/lib/domain/types";
import type { StatementRow } from "@/lib/domain/ingest/csv";
import {
  AUTO_MERGE_THRESHOLD,
  REVIEW_THRESHOLD,
  isCompatible,
  matchRows,
  scoreMatch,
} from "@/lib/domain/ingest/dedup";

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: "e1",
    description: "Swiggy",
    amount: 450,
    category: "Food",
    date: "2026-07-01",
    type: "expense",
    accountId: "acc",
    affectsBalance: true,
    tags: [],
    attachments: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function row(overrides: Partial<StatementRow>): StatementRow {
  return {
    date: "2026-07-01",
    description: "UPI-SWIGGY-swiggy@icici-412345678901",
    amount: 450,
    direction: "debit",
    ...overrides,
  };
}

describe("scoreMatch", () => {
  it("short-circuits to 1 on reference-number match", () => {
    const target = expense({
      provenance: [{ kind: "capture", refNo: "412345678901" }],
    });
    expect(scoreMatch(row({ refNo: "412345678901" }), target)).toBe(1);
  });

  it("auto-merges same-day, exact-amount, same-brand pairs", () => {
    const score = scoreMatch(row({}), expense({}));
    expect(score).toBeGreaterThanOrEqual(AUTO_MERGE_THRESHOLD);
  });

  it("puts exact amount + same day with unrelated text in the review band", () => {
    const score = scoreMatch(
      row({ description: "POS 4123XX SOME RANDOM STORE" }),
      expense({ description: "Groceries run", category: "Shopping" }),
    );
    expect(score).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
    expect(score).toBeLessThan(AUTO_MERGE_THRESHOLD);
  });

  it("returns 0 outside amount tolerance or date window", () => {
    expect(scoreMatch(row({ amount: 460 }), expense({}))).toBe(0);
    expect(scoreMatch(row({ date: "2026-07-09" }), expense({}))).toBe(0);
  });

  it("brand matching survives legal-entity narrations", () => {
    const score = scoreMatch(
      row({ description: "BUNDL TECHNOLOGIES PVT LTD" }),
      expense({ description: "swiggy dinner" }),
    );
    expect(score).toBeGreaterThanOrEqual(AUTO_MERGE_THRESHOLD);
  });
});

describe("isCompatible", () => {
  it("matches debits only against outflow rows on the same account", () => {
    expect(isCompatible(row({}), expense({}), "acc")).toBe(true);
    expect(isCompatible(row({}), expense({ accountId: "other" }), "acc")).toBe(false);
    expect(isCompatible(row({}), expense({ type: "income" }), "acc")).toBe(false);
  });

  it("matches credits against income and inbound transfer legs", () => {
    const credit = row({ direction: "credit" });
    expect(isCompatible(credit, expense({ type: "income" }), "acc")).toBe(true);
    expect(
      isCompatible(
        credit,
        expense({ type: "transfer", accountId: "src", transferAccountId: "acc" }),
        "acc",
      ),
    ).toBe(true);
    expect(isCompatible(credit, expense({}), "acc")).toBe(false);
  });

  it("never rematches rows that already carry statement provenance", () => {
    const claimed = expense({
      provenance: [{ kind: "statement", lineHash: "abc" }],
    });
    expect(isCompatible(row({}), claimed, "acc")).toBe(false);
  });
});

describe("matchRows greedy assignment", () => {
  it("assigns each ledger row to at most one statement line", () => {
    const rows = [row({}), row({ date: "2026-07-02" })];
    const matches = matchRows(rows, [expense({})], "acc");
    const claimed = [...matches.values()].map((match) => match.expense.id);
    expect(claimed).toHaveLength(1);
    expect(matches.get(0)?.expense.id).toBe("e1");
    expect(matches.has(1)).toBe(false);
  });

  it("prefers the higher-scoring pairing", () => {
    const rows = [row({ date: "2026-07-03" }), row({})];
    const matches = matchRows(rows, [expense({})], "acc");
    expect(matches.get(1)?.expense.id).toBe("e1");
    expect(matches.has(0)).toBe(false);
  });
});
