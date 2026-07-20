"use client";

/**
 * Categorization, tier three.
 *
 * The pipeline already tries the brand registry, the narration grammar and
 * the user's own rules. This handles what's left: opaque UPI handles and
 * merchant strings none of those recognise.
 *
 * Two design commitments from docs/product-analysis/04:
 *
 *  - **The learning loop is rules, not weights.** Corrections the user has
 *    already made are replayed as few-shot examples, and a confident repeat
 *    classification is offered back as a rule. What the app learns stays
 *    inspectable, editable and exportable — a model that quietly drifts is
 *    the opposite of that.
 *  - **Low confidence is a first-class answer.** A guess the model isn't sure
 *    about is left as "Other" rather than written in. An unhelpful blank beats
 *    a confident mistake the user has to hunt down later.
 */

import { resolveBrand } from "@/lib/brands/registry";
import type { DraftTransaction, Expense, Rule } from "@/lib/domain/types";
import { CATEGORIES, type Category } from "@/lib/domain/types";
import { TTL } from "../cache";
import { runJson } from "../client";
import { categorizePrompt } from "../prompts";
import { featureId } from "../prompts/registry";
import { userText } from "../provider";
import { categorizeResultSchema, CATEGORIZE_JSON_SCHEMA, type Confidence } from "../schemas";

/** Batch size. Large enough to be cheap per row, small enough to stay accurate. */
export const MAX_BATCH = 40;

export interface Suggestion {
  draftId: string;
  description: string;
  category: Category;
  confidence: Confidence;
}

export interface CategorizeInput {
  drafts: DraftTransaction[];
  /** The user's own history, mined for corrections to teach from. */
  expenses: Expense[];
  rules: Rule[];
  signal?: AbortSignal;
}

/**
 * Merchant→category pairs the user has demonstrated.
 *
 * Sourced from edited rows and existing rules rather than every transaction:
 * a row the user never touched only shows what the app guessed, which would
 * teach the model to repeat our own mistakes.
 */
export function learningExamples(
  expenses: Expense[],
  rules: Rule[],
  limit = 20,
): { text: string; category: string }[] {
  const examples = new Map<string, string>();

  for (const rule of rules) {
    if (!rule.enabled || !rule.match.text || !rule.actions.category) continue;
    examples.set(rule.match.text.toLowerCase(), rule.actions.category);
  }

  // Newest first: recent corrections reflect current intent better than old ones.
  const edited = expenses
    .filter((expense) => expense.history?.some((change) => change.field === "category"))
    .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));

  for (const expense of edited) {
    const brand = resolveBrand(expense.description);
    const key = (brand?.name ?? expense.description).toLowerCase();
    if (examples.has(key)) continue;
    examples.set(key, expense.category);
    if (examples.size >= limit) break;
  }

  return [...examples.entries()]
    .slice(0, limit)
    .map(([text, category]) => ({ text, category }));
}

/** Drafts the deterministic tiers couldn't place. */
export function needsCategorizing(drafts: DraftTransaction[]): DraftTransaction[] {
  return drafts.filter(
    (draft) =>
      draft.status === "pending" &&
      draft.suggestedType === "expense" &&
      draft.suggestedCategory === "Other",
  );
}

/**
 * Classify a batch. Returns only suggestions worth applying — anything the
 * model wasn't reasonably sure about, or that it left as "Other", is dropped.
 */
export async function categorizeDrafts(
  input: CategorizeInput,
): Promise<{ suggestions: Suggestion[]; considered: number; unsure: number }> {
  const batch = needsCategorizing(input.drafts).slice(0, MAX_BATCH);
  if (batch.length === 0) return { suggestions: [], considered: 0, unsure: 0 };

  const { value } = await runJson(
    {
      feature: featureId(categorizePrompt),
      tier: categorizePrompt.tier,
      system: categorizePrompt.system,
      temperature: categorizePrompt.temperature,
      thinking: categorizePrompt.thinking,
      schema: CATEGORIZE_JSON_SCHEMA,
      messages: [
        userText(
          categorizePrompt.render({
            descriptions: batch.map((draft) => draft.description),
            examples: learningExamples(input.expenses, input.rules),
          }),
        ),
      ],
      // Merchant strings repeat constantly across statements, so the same
      // batch re-run after a failed import costs nothing.
      cacheTtlSeconds: TTL.long,
      signal: input.signal,
    },
    categorizeResultSchema,
  );

  const suggestions: Suggestion[] = [];
  let unsure = 0;

  batch.forEach((draft, index) => {
    const result = value.results[index];
    if (!result) return;
    if (result.confidence === "low" || result.category === "Other") {
      unsure += 1;
      return;
    }
    if (!CATEGORIES.includes(result.category)) {
      unsure += 1;
      return;
    }
    suggestions.push({
      draftId: draft.id,
      description: draft.description,
      category: result.category,
      confidence: result.confidence,
    });
  });

  return { suggestions, considered: batch.length, unsure };
}

/**
 * A merchant classified the same way several times is a rule waiting to be
 * written — offer it rather than silently repeating the model call forever.
 */
export function ruleCandidates(
  suggestions: Suggestion[],
  minOccurrences = 2,
): { text: string; category: Category; count: number }[] {
  const groups = new Map<string, { category: Category; count: number }>();
  for (const suggestion of suggestions) {
    if (suggestion.confidence !== "high") continue;
    const brand = resolveBrand(suggestion.description);
    const key = brand?.name ?? suggestion.description.replace(/\d+/g, "").trim();
    if (key.length < 3) continue;
    const current = groups.get(key);
    if (current && current.category !== suggestion.category) {
      // The model is inconsistent about this merchant — not rule material.
      groups.delete(key);
      continue;
    }
    groups.set(key, {
      category: suggestion.category,
      count: (current?.count ?? 0) + 1,
    });
  }
  return [...groups.entries()]
    .filter(([, value]) => value.count >= minOccurrences)
    .map(([text, value]) => ({ text, category: value.category, count: value.count }))
    .sort((a, b) => b.count - a.count);
}
