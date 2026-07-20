/**
 * Prompt package entry point.
 *
 * Also keeps the three first-generation `build*Prompt` helpers alive as thin
 * wrappers, so the original call sites and their tests keep working while the
 * rest of the app migrates to templates.
 */

export * from "./registry";
export * from "./templates";

import type { MonthlyReview } from "@/lib/domain/review";
import { todayISO } from "@/lib/domain/dates";
import { categorizePrompt, queryCompilePrompt, reviewPrompt } from "./templates";

export function buildReviewPrompt(review: MonthlyReview, currency: string): string {
  return reviewPrompt.render({ review, currency });
}

export function buildFilterPrompt(question: string): string {
  return queryCompilePrompt.render({
    question,
    today: todayISO(),
    accounts: [],
    spaces: [],
  });
}

export function buildCategorizePrompt(descriptions: string[]): string {
  return categorizePrompt.render({ descriptions, examples: [] });
}
