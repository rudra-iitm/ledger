import { describe, expect, it, vi } from "vitest";
import { categorizeJob, briefJob, insightJob } from "@/lib/ai/agent/jobs";
import { ruleCandidates } from "@/lib/ai/features/categorize";
import type { AgentActions, JobContext } from "@/lib/ai/agent/jobs";
import { EMPTY_DATA, type LedgerData } from "@/lib/storage/repository";
import type { DraftTransaction, Expense } from "@/lib/domain/types";

const NOW = new Date(2026, 6, 20);

function draft(overrides: Partial<DraftTransaction> = {}): DraftTransaction {
  return {
    id: "d1",
    batchId: "b1",
    date: "2026-07-19",
    amount: 300,
    direction: "debit",
    description: "UPI/PAYTM/9876",
    rawNarration: "UPI/PAYTM/9876",
    suggestedType: "expense",
    suggestedCategory: "Other",
    tags: [],
    lineHash: "hash-1",
    status: "pending",
    ...overrides,
  } as DraftTransaction;
}

function context(data: Partial<LedgerData>, actions?: Partial<AgentActions>): JobContext {
  return {
    data: { ...EMPTY_DATA, ...data },
    now: NOW,
    actions: {
      applyCategorySuggestions: () => 0,
      learnRule: () => true,
      ...actions,
    },
  };
}

describe("categorizeJob", () => {
  it("is irrelevant when every draft already has a category", () => {
    const placed = draft({ suggestedCategory: "Food" });
    expect(categorizeJob.relevant(context({ inbox: { ...EMPTY_DATA.inbox, drafts: [placed] } }))).toBe(
      false,
    );
  });

  it("is relevant when a draft is stuck on Other", () => {
    expect(
      categorizeJob.relevant(context({ inbox: { ...EMPTY_DATA.inbox, drafts: [draft()] } })),
    ).toBe(true);
  });

  it("fingerprints the uncategorised rows, so confirming one changes it", () => {
    const two = { ...EMPTY_DATA.inbox, drafts: [draft(), draft({ id: "d2", lineHash: "hash-2" })] };
    const one = { ...EMPTY_DATA.inbox, drafts: [draft()] };
    expect(categorizeJob.fingerprint(context({ inbox: two }))).not.toBe(
      categorizeJob.fingerprint(context({ inbox: one })),
    );
  });

  it("ignores rows it cannot act on when fingerprinting", () => {
    // A confirmed row landing in the inbox must not trigger a fresh model call.
    const base = { ...EMPTY_DATA.inbox, drafts: [draft()] };
    const withConfirmed = {
      ...EMPTY_DATA.inbox,
      drafts: [draft(), draft({ id: "d3", lineHash: "h3", status: "confirmed" })],
    };
    expect(categorizeJob.fingerprint(context(base))).toBe(
      categorizeJob.fingerprint(context(withConfirmed)),
    );
  });

  it("costs one call and never more", () => {
    expect(categorizeJob.cost).toBe(1);
  });
});

describe("briefJob", () => {
  it("says nothing on an empty ledger", () => {
    expect(briefJob.relevant(context({ accounts: [], expenses: [] }))).toBe(false);
  });

  it("re-fingerprints across a date boundary so the brief is never stale", () => {
    const data = { expenses: [{ id: "e" } as Expense] };
    const today = briefJob.fingerprint({ ...context(data), now: new Date(2026, 6, 20) });
    const tomorrow = briefJob.fingerprint({ ...context(data), now: new Date(2026, 6, 21) });
    expect(today).not.toBe(tomorrow);
  });
});

describe("insightJob", () => {
  it("holds off until there is enough history to be worth a call", () => {
    const thin = Array.from({ length: 5 }, (_, i) => ({ id: `e${i}` }) as Expense);
    expect(insightJob.relevant(context({ expenses: thin }))).toBe(false);
  });

  it("runs weekly at most", () => {
    expect(insightJob.minIntervalSeconds).toBe(7 * 24 * 3600);
  });
});

describe("the learning loop", () => {
  it("writes a rule when the model places the same merchant twice, and only once", () => {
    const learnRule = vi.fn().mockReturnValue(true);
    const applyCategorySuggestions = vi.fn().mockReturnValue(2);

    // Two high-confidence hits on the same merchant is the bar for a rule.
    const suggestions = [
      { draftId: "d1", description: "BLINKIT ORDER 1", category: "Food" as const, confidence: "high" as const },
      { draftId: "d2", description: "BLINKIT ORDER 2", category: "Food" as const, confidence: "high" as const },
    ];

    const candidates = ruleCandidates(suggestions);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].category).toBe("Food");

    for (const candidate of candidates) learnRule(candidate.text, candidate.category);
    expect(learnRule).toHaveBeenCalledTimes(1);
    expect(applyCategorySuggestions).not.toHaveBeenCalled();
  });

  it("does not propose a rule when the model was inconsistent about a merchant", () => {
    const conflicting = [
      { draftId: "d1", description: "AMAZON 1", category: "Shopping" as const, confidence: "high" as const },
      { draftId: "d2", description: "AMAZON 2", category: "Food" as const, confidence: "high" as const },
    ];
    expect(ruleCandidates(conflicting)).toHaveLength(0);
  });

  it("does not propose a rule from a single low-confidence guess", () => {
    const weak = [
      { draftId: "d1", description: "ZOMATO", category: "Food" as const, confidence: "low" as const },
      { draftId: "d2", description: "ZOMATO", category: "Food" as const, confidence: "low" as const },
    ];
    expect(ruleCandidates(weak)).toHaveLength(0);
  });
});
