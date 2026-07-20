import { describe, expect, it } from "vitest";
import {
  learningExamples,
  needsCategorizing,
  ruleCandidates,
  type Suggestion,
} from "@/lib/ai/features/categorize";
import type { DraftTransaction, Expense, Rule } from "@/lib/domain/types";

function draft(over: Partial<DraftTransaction> & { id: string }): DraftTransaction {
  return {
    batchId: "b1",
    date: "2026-07-10",
    amount: 100,
    direction: "debit",
    description: "UPI/xyz@axl",
    rawNarration: "UPI/xyz@axl",
    suggestedType: "expense",
    suggestedCategory: "Other",
    tags: [],
    lineHash: `h-${over.id}`,
    status: "pending",
    createdAt: "2026-07-10T00:00:00.000Z",
    ...over,
  } as DraftTransaction;
}

function expense(over: Partial<Expense> & { id: string }): Expense {
  return {
    description: "Thing",
    amount: 100,
    category: "Other",
    date: "2026-07-10",
    type: "expense",
    affectsBalance: true,
    tags: [],
    attachments: [],
    createdAt: "2026-07-10T00:00:00.000Z",
    ...over,
  } as Expense;
}

describe("needsCategorizing", () => {
  it("selects only pending, uncategorised expense drafts", () => {
    const drafts = [
      draft({ id: "a" }),
      draft({ id: "b", suggestedCategory: "Food" }),
      draft({ id: "c", status: "review" }),
      draft({ id: "d", suggestedType: "income" }),
    ];
    expect(needsCategorizing(drafts).map((item) => item.id)).toEqual(["a"]);
  });
});

describe("learningExamples", () => {
  it("teaches from rules the user wrote", () => {
    const rules: Rule[] = [
      {
        id: "r1",
        name: "Blinkit",
        enabled: true,
        match: { text: "BLINKIT" },
        actions: { category: "Food", tags: [] },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    expect(learningExamples([], rules)).toEqual([{ text: "blinkit", category: "Food" }]);
  });

  it("ignores disabled rules and rules with no category action", () => {
    const rules: Rule[] = [
      {
        id: "r1",
        name: "off",
        enabled: false,
        match: { text: "AAA" },
        actions: { category: "Food", tags: [] },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "r2",
        name: "rename only",
        enabled: true,
        match: { text: "BBB" },
        actions: { tags: [], renameTo: "Bee" },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    expect(learningExamples([], rules)).toEqual([]);
  });

  it("teaches from rows the user recategorised, not rows the app guessed", () => {
    const corrected = expense({
      id: "e1",
      description: "SOME MERCHANT",
      category: "Health",
      updatedAt: "2026-07-15T00:00:00.000Z",
      history: [{ at: "2026-07-15T00:00:00.000Z", field: "category", from: "Other", to: "Health" }],
    });
    const untouched = expense({ id: "e2", description: "OTHER MERCHANT", category: "Travel" });

    const examples = learningExamples([corrected, untouched], []);
    expect(examples).toContainEqual({ text: "some merchant", category: "Health" });
    expect(examples.map((item) => item.text)).not.toContain("other merchant");
  });

  it("caps the example count so the prompt can't grow without bound", () => {
    const corrected = Array.from({ length: 50 }, (_, index) =>
      expense({
        id: `e${index}`,
        description: `MERCHANT ${index}`,
        category: "Shopping",
        updatedAt: `2026-07-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
        history: [{ at: "2026-07-01T00:00:00.000Z", field: "category", from: "Other", to: "Shopping" }],
      }),
    );
    expect(learningExamples(corrected, []).length).toBeLessThanOrEqual(20);
  });
});

describe("ruleCandidates", () => {
  const suggestion = (over: Partial<Suggestion>): Suggestion => ({
    draftId: "d",
    description: "SWIGGY ORDER",
    category: "Food",
    confidence: "high",
    ...over,
  });

  it("offers a rule for a merchant classified the same way repeatedly", () => {
    const candidates = ruleCandidates([
      suggestion({ draftId: "1" }),
      suggestion({ draftId: "2" }),
    ]);
    expect(candidates[0]).toMatchObject({ category: "Food", count: 2 });
  });

  it("stays silent on a one-off", () => {
    expect(ruleCandidates([suggestion({ draftId: "1" })])).toEqual([]);
  });

  it("ignores low- and medium-confidence guesses", () => {
    expect(
      ruleCandidates([
        suggestion({ draftId: "1", confidence: "medium" }),
        suggestion({ draftId: "2", confidence: "medium" }),
      ]),
    ).toEqual([]);
  });

  it("drops a merchant the model is inconsistent about", () => {
    expect(
      ruleCandidates([
        suggestion({ draftId: "1", category: "Food" }),
        suggestion({ draftId: "2", category: "Shopping" }),
        suggestion({ draftId: "3", category: "Food" }),
      ]),
    ).toEqual([]);
  });
});
