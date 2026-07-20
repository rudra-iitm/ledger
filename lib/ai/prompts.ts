import type { MonthlyReview } from "@/lib/domain/review";
import { CATEGORIES } from "@/lib/domain/types";
import { TIME_PRESETS } from "@/lib/domain/time-ranges";

/**
 * Prompt builders — pure and data-minimized. Only aggregates and merchant
 * strings the feature genuinely needs are included; never the full ledger,
 * never account numbers, never balances beyond what the user is asking
 * the model to explain.
 */

export function buildReviewPrompt(
  review: MonthlyReview,
  currency: string,
): string {
  const payload = {
    month: review.label,
    currency,
    spent: review.overview.spent,
    budget: review.overview.budget,
    savingsRatePercent: review.overview.savingsRate,
    highlights: review.highlights.map((item) => ({
      label: item.label,
      value: item.value,
      detail: item.detail ?? null,
    })),
    categoryChanges: review.categoryChanges.slice(0, 6).map((item) => ({
      category: item.category,
      current: item.current,
      previous: item.previous,
      changePercent: item.changePct,
    })),
    subscriptions: {
      monthlyTotal: review.subscriptionInsights.monthlyTotal,
      activeCount: review.subscriptionInsights.activeCount,
    },
  };
  return [
    "You are a personal-finance assistant inside a private ledger app.",
    "Write a short, honest summary of this month's money — 3 to 5 sentences.",
    "Rules: plain language, no praise-padding, no emoji, no bullet points.",
    "Mention the biggest driver of change and one concrete, gentle suggestion.",
    "Amounts are in the user's currency; write them with the currency symbol.",
    "Do not invent numbers — only use what is in the data.",
    "",
    `Data: ${JSON.stringify(payload)}`,
  ].join("\n");
}

export function buildFilterPrompt(question: string): string {
  return [
    "Convert this natural-language question about personal expenses into a JSON filter.",
    `Allowed categories: ${CATEGORIES.join(", ")}.`,
    `Allowed presets: ${TIME_PRESETS.filter((preset) => preset !== "custom").join(", ")}.`,
    'Respond with ONLY JSON: {"category": string|null, "preset": string|null, "query": string}.',
    "category must be one of the allowed categories or null.",
    "preset must be one of the allowed presets or null (thisFY/lastFY are Indian financial years, Apr-Mar).",
    "query is leftover free text to match against merchant names/notes; empty string if none.",
    "",
    `Question: ${JSON.stringify(question)}`,
  ].join("\n");
}

export function buildCategorizePrompt(descriptions: string[]): string {
  return [
    "Categorize each Indian personal-finance transaction description.",
    `Allowed categories: ${CATEGORIES.join(", ")}.`,
    "UPI handles, merchant names, and bank narration fragments are common.",
    "Person-to-person transfers with no obvious merchant → \"Other\".",
    'Respond with ONLY a JSON array of category strings, same order and length as the input.',
    "",
    `Descriptions: ${JSON.stringify(descriptions)}`,
  ].join("\n");
}
