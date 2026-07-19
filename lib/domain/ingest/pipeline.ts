import type {
  Account,
  Category,
  DraftTransaction,
  Expense,
  ExpenseSource,
  ImportBatch,
  IncomeCategory,
  Rule,
} from "../types";
import { resolveBrand } from "../../brands/registry";
import { inferCategory } from "../quick-add";
import { computeLineHash, type StatementRow } from "./csv";
import { AUTO_MERGE_THRESHOLD, matchRows } from "./dedup";
import { decodeNarration, fallbackDescription } from "./narration";
import { applyRule, findMatchingRule } from "./rules";

export interface ImportInput {
  rows: StatementRow[];
  accountId: string;
  fileName: string;
  batchId: string;
  now: string;
  accounts: Account[];
  expenses: Expense[];
  drafts: DraftTransaction[];
  rules: Rule[];
  createId: () => string;
}

export interface AutoMerge {
  expenseId: string;
  source: ExpenseSource;
}

export interface ImportResult {
  drafts: DraftTransaction[];
  autoMerges: AutoMerge[];
  batch: ImportBatch;
}

interface Classification {
  suggestedType: DraftTransaction["suggestedType"];
  suggestedCategory: Category;
  suggestedIncomeCategory?: IncomeCategory;
  transferAccountId?: string;
  description: string;
}

function classify(
  row: StatementRow,
  decoded: ReturnType<typeof decodeNarration>,
  accounts: Account[],
  target: Account | undefined,
): Classification {
  const brand = resolveBrand(row.description);
  const description = brand?.name ?? fallbackDescription(decoded, row.description);

  // Credit-card statements: a credit is money INTO the card (payment or
  // refund) — never income. Model it as a cc_payment with unknown source.
  if (target?.type === "credit_card" && row.direction === "credit") {
    return {
      suggestedType: "cc_payment",
      suggestedCategory: "Bills",
      transferAccountId: target.id,
      description:
        decoded.channel === "refund"
          ? `Refund — ${description}`
          : `Payment received — ${target.name}`,
    };
  }

  if (row.direction === "credit") {
    const incomeCategory: IncomeCategory =
      decoded.channel === "salary"
        ? "Salary"
        : decoded.channel === "interest"
          ? "Interest"
          : decoded.channel === "refund"
            ? "Refunds"
            : "Other";
    return {
      suggestedType: "income",
      suggestedCategory: "Other",
      suggestedIncomeCategory: incomeCategory,
      // Credits are payers, not merchants — the brand registry would
      // mis-resolve narrations like "CREDIT INTEREST" (→ CRED).
      description:
        incomeCategory === "Other"
          ? description
          : fallbackDescription(decoded, row.description),
    };
  }

  // Bank-side leg of a card bill payment: debit whose narration names one
  // of the user's credit cards.
  if (row.direction === "debit" && target?.type !== "credit_card") {
    const lower = row.description.toLowerCase();
    const card = accounts.find(
      (account) =>
        account.type === "credit_card" &&
        !account.archived &&
        lower.includes(account.name.toLowerCase()) &&
        (/\bcard\b|\bcc\b/i.test(row.description) || account.name.length >= 8),
    );
    if (card) {
      return {
        suggestedType: "cc_payment",
        suggestedCategory: "Bills",
        transferAccountId: card.id,
        description: `Payment · ${card.name}`,
      };
    }
  }

  if (decoded.channel === "atm") {
    const cash = accounts.find(
      (account) => account.type === "cash" && !account.archived,
    );
    if (cash) {
      return {
        suggestedType: "transfer",
        suggestedCategory: "Other",
        transferAccountId: cash.id,
        description: "ATM withdrawal",
      };
    }
    return {
      suggestedType: "expense",
      suggestedCategory: "Other",
      description: "ATM withdrawal",
    };
  }

  if (decoded.channel === "charge") {
    return { suggestedType: "expense", suggestedCategory: "Bills", description };
  }
  if (decoded.channel === "nach") {
    const investmentLike = /\b(sip|mutual|mf|amc|fund|nps|clearing corp)\b/i.test(
      row.description,
    );
    return {
      suggestedType: "expense",
      suggestedCategory: investmentLike ? "Investments" : "Bills",
      description,
    };
  }

  const category = brand?.category ?? inferCategory(description);
  return { suggestedType: "expense", suggestedCategory: category, description };
}

/**
 * The statement-import pipeline: decode → classify → rules → dedup.
 * Pure: all writes are returned to the caller as drafts + auto-merge patches.
 * lineHash makes re-importing an overlapping statement a no-op.
 */
export function runImportPipeline(input: ImportInput): ImportResult {
  const { rows, accountId, accounts, expenses, drafts, rules } = input;

  const knownHashes = new Set<string>();
  for (const expense of expenses) {
    for (const source of expense.provenance ?? []) {
      if (source.lineHash) knownHashes.add(source.lineHash);
    }
  }
  for (const draft of drafts) knownHashes.add(draft.lineHash);

  const fresh: { row: StatementRow; hash: string }[] = [];
  let duplicateCount = 0;
  for (const row of rows) {
    const hash = computeLineHash(accountId, row);
    if (knownHashes.has(hash)) {
      duplicateCount += 1;
      continue;
    }
    knownHashes.add(hash);
    fresh.push({ row, hash });
  }

  const matches = matchRows(
    fresh.map((entry) => entry.row),
    expenses,
    accountId,
  );

  const newDrafts: DraftTransaction[] = [];
  const autoMerges: AutoMerge[] = [];
  let autoMergedCount = 0;
  let reviewCount = 0;

  fresh.forEach(({ row, hash }, index) => {
    const match = matches.get(index);
    if (match && match.score >= AUTO_MERGE_THRESHOLD) {
      autoMergedCount += 1;
      autoMerges.push({
        expenseId: match.expense.id,
        source: {
          kind: "statement",
          batchId: input.batchId,
          lineHash: hash,
          refNo: row.refNo,
        },
      });
      return;
    }

    const decoded = decodeNarration(row.description);
    const classified = classify(
      row,
      decoded,
      accounts,
      accounts.find((account) => account.id === accountId),
    );
    let draft: DraftTransaction = {
      id: input.createId(),
      batchId: input.batchId,
      accountId,
      date: row.date,
      amount: row.amount,
      direction: row.direction,
      description: classified.description,
      rawNarration: row.description,
      channel: decoded.channel,
      refNo: row.refNo ?? decoded.refNo,
      vpa: decoded.vpa,
      suggestedType: classified.suggestedType,
      suggestedCategory: classified.suggestedCategory,
      suggestedIncomeCategory: classified.suggestedIncomeCategory,
      transferAccountId: classified.transferAccountId,
      tags: [],
      lineHash: hash,
      status: match ? "review" : "pending",
      matchExpenseId: match?.expense.id,
      matchScore: match ? Math.round(match.score * 100) / 100 : undefined,
      createdAt: input.now,
    };

    const rule = findMatchingRule(
      {
        description: draft.description,
        rawNarration: draft.rawNarration,
        channel: draft.channel,
        accountId,
        direction: draft.direction,
        amount: draft.amount,
      },
      rules,
    );
    if (rule) draft = applyRule(draft, rule);
    if (draft.status === "review") reviewCount += 1;
    newDrafts.push(draft);
  });

  const closingBalance = rows.length
    ? rows[rows.length - 1].balance
    : undefined;

  return {
    drafts: newDrafts,
    autoMerges,
    batch: {
      id: input.batchId,
      accountId,
      fileName: input.fileName,
      importedAt: input.now,
      rowCount: rows.length,
      newCount: newDrafts.length - reviewCount,
      autoMergedCount,
      reviewCount,
      duplicateCount,
      closingBalance,
    },
  };
}

/** Builds the ledger expense a confirmed draft becomes. */
export function draftToExpense(
  draft: DraftTransaction,
  id: string,
  createdAt: string,
): Expense {
  const provenance: ExpenseSource[] = [
    {
      kind: "statement",
      batchId: draft.batchId,
      lineHash: draft.lineHash,
      refNo: draft.refNo,
    },
  ];
  const base = {
    id,
    description: draft.description,
    amount: draft.amount,
    date: draft.date,
    accountId: draft.accountId,
    affectsBalance: true,
    tags: draft.tags,
    notes: draft.notes,
    spaceId: draft.spaceId,
    attachments: [],
    provenance,
    createdAt,
  };
  switch (draft.suggestedType) {
    case "income":
      return {
        ...base,
        type: "income",
        category: "Other",
        incomeCategory: draft.suggestedIncomeCategory ?? "Other",
      };
    case "transfer":
      return {
        ...base,
        type: "transfer",
        category: "Other",
        transferAccountId: draft.transferAccountId,
      };
    case "cc_payment":
      return {
        ...base,
        // A payment imported from the card's own statement has an unknown
        // source; leaving accountId as the card would net the legs to zero.
        accountId:
          draft.transferAccountId === draft.accountId
            ? undefined
            : draft.accountId,
        type: "cc_payment",
        category: "Bills",
        paymentTargetId: draft.transferAccountId,
      };
    default:
      return { ...base, type: "expense", category: draft.suggestedCategory };
  }
}
