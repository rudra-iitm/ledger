import type { DraftTransaction, Rule } from "../types";

export interface RuleInput {
  description: string;
  rawNarration: string;
  channel?: string;
  accountId: string;
  direction: "debit" | "credit";
  amount: number;
}

/** First-match-wins over enabled rules; disabled rules never fire. */
export function findMatchingRule(input: RuleInput, rules: Rule[]): Rule | null {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (ruleMatches(rule, input)) return rule;
  }
  return null;
}

export function ruleMatches(rule: Rule, input: RuleInput): boolean {
  const { match } = rule;
  if (match.text) {
    const needle = match.text.toLowerCase();
    const haystack = `${input.description} ${input.rawNarration}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  if (match.channel && match.channel !== input.channel) return false;
  if (match.accountId && match.accountId !== input.accountId) return false;
  if (match.direction && match.direction !== input.direction) return false;
  if (match.minAmount !== undefined && input.amount < match.minAmount) return false;
  if (match.maxAmount !== undefined && input.amount > match.maxAmount) return false;
  return true;
}

/** Applies a rule's actions to a draft, recording which rule fired. */
export function applyRule(
  draft: DraftTransaction,
  rule: Rule,
): DraftTransaction {
  const next: DraftTransaction = { ...draft, appliedRuleId: rule.id };
  if (rule.actions.renameTo) next.description = rule.actions.renameTo;
  if (rule.actions.category) next.suggestedCategory = rule.actions.category;
  if (rule.actions.incomeCategory) {
    next.suggestedIncomeCategory = rule.actions.incomeCategory;
  }
  if (rule.actions.spaceId) next.spaceId = rule.actions.spaceId;
  if (rule.actions.tags.length > 0) {
    next.tags = [...new Set([...draft.tags, ...rule.actions.tags])];
  }
  return next;
}
