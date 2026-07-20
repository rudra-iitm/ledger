/**
 * Documents → drafts.
 *
 * A scanned receipt enters the ledger through exactly the same gate as a bank
 * statement line: it becomes a `DraftTransaction` in the inbox, gets the
 * rules engine applied, and waits for the user to confirm it. Nothing an
 * extraction model produces is ever written straight to the ledger.
 *
 * This module is the neutral boundary between the two. It knows nothing about
 * AI — it takes a plain `DocumentCapture` — which is what keeps the store from
 * importing anything out of `lib/ai`.
 */

import { computeLineHash } from "./csv";
import type {
  Category,
  DraftDirection,
  DraftTransaction,
  IncomeCategory,
} from "../types";

/** What any extractor must produce, whoever wrote it. */
export interface DocumentCapture {
  date: string;
  amount: number;
  direction: DraftDirection;
  description: string;
  category: Category;
  incomeCategory?: IncomeCategory;
  referenceNumber?: string;
  /** Human-readable provenance shown on the draft, e.g. the file name. */
  sourceLabel: string;
  /** Line items and anything else worth keeping on the row. */
  notes?: string;
}

/**
 * Stable identity for a scanned document.
 *
 * Uses the same hash space as statement lines, so scanning the receipt for a
 * purchase that later arrives on a statement collides and dedupes rather than
 * double-counting.
 */
export function documentLineHash(capture: DocumentCapture): string {
  return computeLineHash("document", {
    date: capture.date,
    description: capture.description,
    amount: capture.amount,
    direction: capture.direction,
    refNo: capture.referenceNumber,
  });
}

export function documentToDraft(
  capture: DocumentCapture,
  id: string,
  createdAt: string,
  accountId?: string,
): DraftTransaction {
  return {
    id,
    batchId: "document",
    accountId,
    date: capture.date,
    amount: capture.amount,
    direction: capture.direction,
    description: capture.description,
    rawNarration: capture.sourceLabel,
    channel: "document",
    refNo: capture.referenceNumber,
    suggestedType: capture.direction === "credit" ? "income" : "expense",
    suggestedCategory: capture.category,
    suggestedIncomeCategory:
      capture.direction === "credit" ? (capture.incomeCategory ?? "Other") : undefined,
    tags: [],
    notes: capture.notes,
    lineHash: documentLineHash(capture),
    status: "pending",
    createdAt,
  };
}
