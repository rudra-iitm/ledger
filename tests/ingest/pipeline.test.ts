import { describe, expect, it } from "vitest";
import type { Account, Expense, Rule } from "@/lib/domain/types";
import type { StatementRow } from "@/lib/domain/ingest/csv";
import { draftToExpense, runImportPipeline } from "@/lib/domain/ingest/pipeline";
import { applyRule, findMatchingRule } from "@/lib/domain/ingest/rules";
import { DEFAULT_ACCOUNTS } from "@/lib/domain/types";

let counter = 0;
const nextId = () => `id-${(counter += 1)}`;

function baseInput(rows: StatementRow[], overrides?: Partial<Parameters<typeof runImportPipeline>[0]>) {
  return {
    rows,
    accountId: "acc-bank",
    fileName: "statement.csv",
    batchId: "batch-1",
    now: "2026-07-19T00:00:00.000Z",
    accounts: DEFAULT_ACCOUNTS as Account[],
    expenses: [] as Expense[],
    drafts: [],
    rules: [] as Rule[],
    createId: nextId,
    ...overrides,
  };
}

const rows: StatementRow[] = [
  {
    date: "2026-07-01",
    description: "UPI-SWIGGY-swiggy@icici-412345678901",
    amount: 450,
    direction: "debit",
    refNo: "412345678901",
  },
  {
    date: "2026-07-02",
    description: "SALARY JUL ACME CORP",
    amount: 150000,
    direction: "credit",
  },
  {
    date: "2026-07-03",
    description: "ATW-512345-HDFC BANK ATM",
    amount: 2000,
    direction: "debit",
  },
  {
    date: "2026-07-04",
    description: "CREDIT INTEREST CAPITALISED",
    amount: 312.5,
    direction: "credit",
    balance: 160862.5,
  },
];

describe("runImportPipeline", () => {
  it("classifies brand expenses, salary, ATM transfers, and interest", () => {
    const result = runImportPipeline(baseInput(rows));
    expect(result.drafts).toHaveLength(4);
    const [swiggy, salary, atm, interest] = result.drafts;
    expect(swiggy).toMatchObject({
      description: "Swiggy",
      suggestedType: "expense",
      suggestedCategory: "Food",
      channel: "upi",
    });
    expect(salary).toMatchObject({
      suggestedType: "income",
      suggestedIncomeCategory: "Salary",
    });
    expect(atm).toMatchObject({
      suggestedType: "transfer",
      transferAccountId: "acc-cash",
      description: "ATM withdrawal",
    });
    expect(interest).toMatchObject({
      suggestedType: "income",
      suggestedIncomeCategory: "Interest",
      // Regression: "CREDIT INTEREST" must not brand-resolve to CRED.
      description: "Bank interest",
    });
    expect(result.batch).toMatchObject({
      rowCount: 4,
      newCount: 4,
      autoMergedCount: 0,
      reviewCount: 0,
      duplicateCount: 0,
      closingBalance: 160862.5,
    });
  });

  it("is idempotent: re-importing the same rows yields only duplicates", () => {
    const first = runImportPipeline(baseInput(rows));
    const second = runImportPipeline(
      baseInput(rows, { drafts: first.drafts }),
    );
    expect(second.drafts).toHaveLength(0);
    expect(second.batch.duplicateCount).toBe(4);
  });

  it("auto-merges against a matching manual entry and enriches it", () => {
    const manual: Expense = {
      id: "manual-1",
      description: "swiggy dinner",
      amount: 450,
      category: "Food",
      date: "2026-07-01",
      type: "expense",
      accountId: "acc-bank",
      affectsBalance: true,
      tags: [],
      attachments: [],
      createdAt: "2026-07-01T20:00:00.000Z",
    };
    const result = runImportPipeline(
      baseInput([rows[0]], { expenses: [manual] }),
    );
    expect(result.drafts).toHaveLength(0);
    expect(result.autoMerges).toEqual([
      {
        expenseId: "manual-1",
        source: {
          kind: "statement",
          batchId: "batch-1",
          lineHash: expect.any(String),
          refNo: "412345678901",
        },
      },
    ]);
    expect(result.batch.autoMergedCount).toBe(1);
  });

  it("applies rules to drafts (first match wins)", () => {
    const rules: Rule[] = [
      {
        id: "r1",
        name: "Swiggy is ordering in",
        enabled: true,
        match: { text: "swiggy" },
        actions: { tags: ["ordering-in"], category: "Entertainment" },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "r2",
        name: "Never fires",
        enabled: true,
        match: { text: "swiggy" },
        actions: { category: "Other", tags: [] },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const result = runImportPipeline(baseInput([rows[0]], { rules }));
    expect(result.drafts[0]).toMatchObject({
      appliedRuleId: "r1",
      suggestedCategory: "Entertainment",
      tags: ["ordering-in"],
    });
  });
});

describe("rules engine", () => {
  const rule: Rule = {
    id: "r1",
    name: "test",
    enabled: true,
    match: { text: "netflix", direction: "debit", minAmount: 100 },
    actions: { category: "Bills", tags: ["subscription"] },
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const input = {
    description: "Netflix",
    rawNarration: "NACH-NETFLIX ENTERTAINMENT",
    channel: "nach",
    accountId: "acc",
    direction: "debit" as const,
    amount: 649,
  };

  it("respects every match condition", () => {
    expect(findMatchingRule(input, [rule])?.id).toBe("r1");
    expect(findMatchingRule({ ...input, amount: 50 }, [rule])).toBeNull();
    expect(findMatchingRule({ ...input, direction: "credit" }, [rule])).toBeNull();
    expect(
      findMatchingRule(input, [{ ...rule, enabled: false }]),
    ).toBeNull();
  });

  it("applyRule merges tags without duplicates", () => {
    const draft = draftToExpense(
      applyRule(
        {
          id: "d1",
          batchId: "b",
          accountId: "acc",
          date: "2026-07-01",
          amount: 649,
          direction: "debit",
          description: "Netflix",
          rawNarration: "NACH-NETFLIX",
          suggestedType: "expense",
          suggestedCategory: "Other",
          tags: ["subscription"],
          lineHash: "hash",
          status: "pending",
          createdAt: "2026-07-19T00:00:00.000Z",
        },
        rule,
      ),
      "e-new",
      "2026-07-19T00:00:00.000Z",
    );
    expect(draft.tags).toEqual(["subscription"]);
    expect(draft.category).toBe("Bills");
  });
});

describe("draftToExpense", () => {
  it("maps income, transfer, and expense drafts to correct ledger shapes", () => {
    const base = {
      id: "d1",
      batchId: "b",
      accountId: "acc",
      date: "2026-07-01",
      amount: 100,
      direction: "credit" as const,
      description: "Payout",
      rawNarration: "NEFT-PAYOUT",
      suggestedType: "income" as const,
      suggestedCategory: "Other" as const,
      suggestedIncomeCategory: "Freelance" as const,
      tags: [],
      lineHash: "hash",
      status: "pending" as const,
      createdAt: "2026-07-19T00:00:00.000Z",
    };
    const income = draftToExpense(base, "e1", base.createdAt);
    expect(income).toMatchObject({
      type: "income",
      incomeCategory: "Freelance",
      accountId: "acc",
      provenance: [{ kind: "statement", lineHash: "hash" }],
    });
    const transfer = draftToExpense(
      {
        ...base,
        suggestedType: "transfer",
        direction: "debit",
        transferAccountId: "acc-cash",
      },
      "e2",
      base.createdAt,
    );
    expect(transfer).toMatchObject({
      type: "transfer",
      transferAccountId: "acc-cash",
    });
  });
});
