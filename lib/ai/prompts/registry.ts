/**
 * Prompt templates as first-class objects.
 *
 * A prompt is a piece of product behaviour, so it gets the same treatment as
 * code: an id, a version, a declared model tier, and a pure render function.
 * Concretely this buys us —
 *
 *  - **testability**: a template can be rendered and asserted on without a
 *    network call, which is how the privacy tests prove no raw ledger data
 *    reaches a prompt;
 *  - **cache safety**: `version` participates in the request hash, so editing
 *    a prompt invalidates its cached answers instead of serving stale ones;
 *  - **auditability**: `PROMPTS` is the complete list of things this app can
 *    ask a model to do.
 */

import type { ModelTier } from "../models";
import type { ThinkingLevel } from "../provider";

export interface PromptTemplate<Vars> {
  id: string;
  /** Bump on any wording change that should invalidate cached responses. */
  version: number;
  /** One line, shown in the Settings prompt inspector. */
  description: string;
  tier: ModelTier;
  /** Persona and rules — stable across calls, so it stays out of `render`. */
  system?: string;
  thinking?: ThinkingLevel;
  temperature?: number;
  render: (vars: Vars) => string;
}

const registry = new Map<string, PromptTemplate<never>>();

/** Define and register a template. Duplicate ids are a programming error. */
export function definePrompt<Vars>(
  template: PromptTemplate<Vars>,
): PromptTemplate<Vars> {
  if (registry.has(template.id)) {
    throw new Error(`Duplicate prompt id: ${template.id}`);
  }
  registry.set(template.id, template as unknown as PromptTemplate<never>);
  return template;
}

export function allPrompts(): PromptTemplate<never>[] {
  return [...registry.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** The feature id used for telemetry and caching: `id@version`. */
export function featureId(template: PromptTemplate<never> | { id: string; version: number }): string {
  return `${template.id}@${template.version}`;
}

/**
 * Shared house style.
 *
 * Every narrating prompt inherits this. The rules exist because each was a
 * failure we saw: models pad with praise, invent plausible totals, and hedge
 * so much the answer carries no information.
 */
export const HOUSE_RULES = [
  "You are the assistant inside a private personal-finance app. The user is looking at their own data.",
  "Never invent or estimate a number. Every figure you state must appear in the data you were given.",
  "If the data doesn't answer the question, say so plainly and say what would.",
  "Write plain, direct sentences. No praise-padding, no emoji, no motivational filler.",
  "Money is in the user's own currency — write it with the symbol you were given.",
  "Be specific about time: say which month or period a number covers.",
].join("\n");

/** Appended where the product promises an explainable answer. */
export const EXPLAIN_RULES = [
  "Explain your reasoning: name the figures you used and where they came from.",
  "State any assumption you had to make.",
  "If the data is thin or the period is incomplete, say how that limits the answer.",
].join("\n");
