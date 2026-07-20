import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/ai/parse";
import {
  buildCategorizePrompt,
  buildFilterPrompt,
  buildReviewPrompt,
  reviewPrompt,
} from "@/lib/ai/prompts";
import { buildMonthlyReview } from "@/lib/domain/review";
import { DEFAULT_ACCOUNTS } from "@/lib/domain/types";

describe("extractJson", () => {
  it("parses raw JSON, fenced JSON, and JSON with prose around it", () => {
    expect(extractJson<string[]>('["Food","Travel"]')).toEqual(["Food", "Travel"]);
    expect(
      extractJson<{ a: number }>('```json\n{"a": 1}\n```'),
    ).toEqual({ a: 1 });
    expect(
      extractJson<{ preset: string }>(
        'Here is the filter you asked for: {"preset": "lastMonth"} — hope that helps!',
      ),
    ).toEqual({ preset: "lastMonth" });
    expect(extractJson("no json here at all")).toBeNull();
  });
});

describe("prompt builders", () => {
  it("filter prompt embeds the allowed vocabularies and the question only", () => {
    const prompt = buildFilterPrompt("what did I spend on food last month");
    expect(prompt).toContain("Food");
    expect(prompt).toContain("lastMonth");
    expect(prompt).toContain("what did I spend on food last month");
    // no ledger data slots exist in this prompt
    expect(prompt).not.toMatch(/balance|account number/i);
  });

  it("categorize prompt carries descriptions verbatim and the category list", () => {
    const prompt = buildCategorizePrompt(["UPI/xyz@axl", "BLINKIT ORDER"]);
    expect(prompt).toContain("UPI/xyz@axl");
    expect(prompt).toContain("Entertainment");
  });

  it("review prompt sends aggregates, not transactions", () => {
    const review = buildMonthlyReview(
      {
        expenses: [
          {
            id: "e1",
            description: "Groceries at DMart",
            amount: 4000,
            category: "Food",
            date: "2026-07-05",
            type: "expense",
            affectsBalance: true,
            tags: [],
            attachments: [],
            createdAt: "2026-07-05T00:00:00.000Z",
          },
        ],
        spaces: [],
        accounts: DEFAULT_ACCOUNTS,
        subscriptions: [],
        monthlyBudget: 10000,
        currency: "₹",
      },
      "2026-07",
    );
    const prompt = buildReviewPrompt(review, "₹");
    expect(prompt).toContain('"spent":4000');
    // The no-inventing rule now lives in the template's system instruction,
    // where it applies to every narrating prompt rather than just this one.
    expect(reviewPrompt.system).toContain("Never invent");
  });
});

describe("extractJson truncation repair", () => {
  it("repairs Gemini-3-style truncated JSON (missing closing braces)", () => {
    expect(
      extractJson<{ query: string }>(
        '{\n  "category": null,\n  "preset": null,\n  "query": "sanjana"',
      ),
    ).toEqual({ category: null, preset: null, query: "sanjana" });
    expect(extractJson<string[]>('["Food", "Travel"')).toEqual(["Food", "Travel"]);
    expect(
      extractJson<{ a: string }>('{"a": "unterminated strin'),
    ).toEqual({ a: "unterminated strin" });
  });
});
