/**
 * Every prompt this app can send, in one file.
 *
 * Data-minimisation is enforced here rather than at the call site: each
 * `render` decides exactly which fields leave the device, so reviewing what
 * the app discloses means reading this file and nothing else.
 */

import type { MonthlyReview } from "@/lib/domain/review";
import type { HealthReport } from "@/lib/domain/health";
import type { FinanceAlert } from "@/lib/domain/anomalies";
import { CATEGORIES, INCOME_CATEGORIES } from "@/lib/domain/types";
import { TIME_PRESETS } from "@/lib/domain/time-ranges";
import { definePrompt, EXPLAIN_RULES, HOUSE_RULES } from "./registry";

/* ------------------------------------------------------------------ */
/* Copilot                                                            */
/* ------------------------------------------------------------------ */

export interface CopilotVars {
  currency: string;
  today: string;
  accountSummary: string;
}

export const copilotPrompt = definePrompt<CopilotVars>({
  id: "copilot.answer",
  version: 1,
  description: "Conversational finance copilot with read-only tools over the ledger.",
  tier: "balanced",
  temperature: 0.3,
  thinking: "low",
  system: [
    HOUSE_RULES,
    "",
    "You have read-only tools that compute over the user's real ledger.",
    "Call a tool for anything factual. Do not answer money questions from memory or arithmetic of your own — the tools are the only source of numbers.",
    "You may call several tools, and call them again with different arguments to refine an answer.",
    "When a tool returns an error, read it and retry with corrected arguments once.",
    "",
    "Answer format: lead with the direct answer in one sentence, then at most three short supporting sentences.",
    EXPLAIN_RULES,
    "",
    "You cannot change the ledger. If the user asks you to add, edit or delete something, explain which screen does it.",
    "You are not a licensed financial adviser. You may explain the user's own data and general trade-offs, but do not recommend specific securities or make promises about returns.",
  ].join("\n"),
  render: (vars) =>
    [
      `Today is ${vars.today}. The user's currency symbol is ${vars.currency}.`,
      "",
      "Their accounts:",
      vars.accountSummary,
    ].join("\n"),
});

/* ------------------------------------------------------------------ */
/* Natural-language query compilation                                 */
/* ------------------------------------------------------------------ */

export interface QueryCompileVars {
  question: string;
  today: string;
  accounts: { id: string; name: string }[];
  spaces: { id: string; name: string }[];
}

export const queryCompilePrompt = definePrompt<QueryCompileVars>({
  id: "search.compile",
  version: 1,
  description: "Compile a natural-language question into a typed ledger query.",
  tier: "fast",
  temperature: 0,
  thinking: "off",
  system:
    "You convert questions about personal spending into a JSON query object. You never answer the question itself — you only build the query. Output JSON only.",
  render: (vars) =>
    [
      `Today is ${vars.today}.`,
      `Allowed categories: ${CATEGORIES.join(", ")}.`,
      `Allowed time presets: ${TIME_PRESETS.filter((preset) => preset !== "custom").join(", ")}.`,
      "thisFY/lastFY are Indian financial years running April to March.",
      "Use preset 'custom' with start and end (YYYY-MM-DD) only when no preset fits.",
      "",
      "Choose intent: 'total' for how much, 'breakdown' for by-category, 'trend' for over-time, 'list' for which transactions, 'compare' for one period against another (set comparePreset).",
      "Set rows to 'income' for earnings questions, otherwise 'spend'.",
      "Put leftover merchant words in 'text'. Leave a field out when the question doesn't mention it.",
      "",
      vars.accounts.length
        ? `Accounts (use the id when the question names one): ${vars.accounts
            .map((account) => `${account.name}=${account.id}`)
            .join(", ")}`
        : "",
      vars.spaces.length
        ? `Spaces: ${vars.spaces.map((space) => `${space.name}=${space.id}`).join(", ")}`
        : "",
      "",
      `Question: ${JSON.stringify(vars.question)}`,
    ]
      .filter(Boolean)
      .join("\n"),
});

/* ------------------------------------------------------------------ */
/* Categorization                                                     */
/* ------------------------------------------------------------------ */

export interface CategorizeVars {
  descriptions: string[];
  /** Merchant→category pairs the user has already corrected by hand. */
  examples: { text: string; category: string }[];
}

export const categorizePrompt = definePrompt<CategorizeVars>({
  id: "categorize.batch",
  version: 2,
  description: "Classify imported transaction descriptions, with confidence.",
  tier: "fast",
  temperature: 0,
  thinking: "off",
  system:
    "You classify Indian personal-finance transaction descriptions into fixed categories. Output JSON only.",
  render: (vars) =>
    [
      `Allowed categories: ${CATEGORIES.join(", ")}.`,
      "Descriptions are bank narration fragments: UPI handles, merchant names, NEFT/IMPS references.",
      'A person-to-person transfer with no recognisable merchant is "Other".',
      "Set confidence to how sure you are: high, medium or low. Use low when the text is opaque — a low-confidence guess is more useful than a confident wrong one.",
      "Return one entry per input, in the same order.",
      "",
      vars.examples.length
        ? [
            "The user has previously corrected these, so follow the same judgement:",
            ...vars.examples
              .slice(0, 20)
              .map((example) => `  ${example.text} → ${example.category}`),
            "",
          ].join("\n")
        : "",
      `Descriptions: ${JSON.stringify(vars.descriptions)}`,
    ]
      .filter(Boolean)
      .join("\n"),
});

/* ------------------------------------------------------------------ */
/* Document understanding                                             */
/* ------------------------------------------------------------------ */

export type DocumentKind =
  | "receipt"
  | "invoice"
  | "payslip"
  | "statement"
  | "other";

export interface DocumentVars {
  hint: DocumentKind | "auto";
  today: string;
}

export const documentPrompt = definePrompt<DocumentVars>({
  id: "document.extract",
  version: 1,
  description: "Extract structured financial data from a receipt, invoice, payslip or statement.",
  tier: "vision",
  temperature: 0,
  system: [
    "You extract structured data from financial documents: receipts, invoices, payslips, bank and investment statements.",
    "Transcribe only what is visibly present. Never infer a total that isn't printed, and never complete a number that is cut off.",
    "If a field is absent or unreadable, return null for it rather than guessing.",
    "Output JSON only.",
  ].join("\n"),
  render: (vars) =>
    [
      `Today is ${vars.today}; use it only to resolve relative dates like "yesterday".`,
      vars.hint === "auto"
        ? "Identify the document type yourself."
        : `The user says this is a ${vars.hint}.`,
      `Categories you may assign: ${CATEGORIES.join(", ")}.`,
      `Income categories: ${INCOME_CATEGORIES.join(", ")}.`,
      "Dates must be YYYY-MM-DD. Amounts are plain numbers — no symbols, no thousands separators.",
      "For a multi-line receipt, put the individual items in lineItems and the payable total in totalAmount.",
      "Set confidence to low when the image is blurred, cropped, or partially illegible.",
    ].join("\n"),
});

/* ------------------------------------------------------------------ */
/* Advisory narration over deterministic engines                      */
/* ------------------------------------------------------------------ */

export interface ReviewVars {
  review: MonthlyReview;
  currency: string;
}

export const reviewPrompt = definePrompt<ReviewVars>({
  id: "review.summary",
  version: 2,
  description: "Narrate the monthly review in plain language.",
  tier: "balanced",
  temperature: 0.3,
  system: HOUSE_RULES,
  render: (vars) => {
    const { review } = vars;
    const payload = {
      month: review.label,
      currency: vars.currency,
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
      "Write an honest summary of this month's money — 3 to 5 sentences, no bullet points.",
      "Name the biggest driver of change, and end with one concrete, gentle suggestion.",
      "",
      `Data: ${JSON.stringify(payload)}`,
    ].join("\n");
  },
});

export interface HealthAdviceVars {
  report: HealthReport;
  currency: string;
}

export const healthAdvicePrompt = definePrompt<HealthAdviceVars>({
  id: "health.advice",
  version: 1,
  description: "Turn the health score's six components into a ranked action plan.",
  tier: "deep",
  temperature: 0.2,
  thinking: "high",
  system: [
    HOUSE_RULES,
    EXPLAIN_RULES,
    "",
    "The score and its components were computed deterministically and are correct. Your job is to prioritise, not to recompute.",
    "Output JSON only.",
  ].join("\n"),
  render: (vars) =>
    [
      `Currency: ${vars.currency}. Overall score: ${vars.report.score}/100.`,
      vars.report.thin
        ? "NOTE: the ledger is thin (little history), so say the score is provisional."
        : "",
      "",
      "Components, each with the formula behind it:",
      ...vars.report.components.map(
        (component) =>
          `- ${component.label}: ${component.score}/100 (weight ${component.weight}). Value: ${component.value}. Formula: ${component.detail}`,
      ),
      "",
      "Identify the strengths worth keeping, the weaknesses that matter most, and up to three actions ranked by how much they would raise the score.",
      "For each action, state the component it improves and the reasoning in one sentence.",
    ]
      .filter(Boolean)
      .join("\n"),
});

export interface InsightsVars {
  currency: string;
  month: string;
  alerts: FinanceAlert[];
  categoryChanges: { category: string; current: number; previous: number; changePct: number }[];
  subscriptions: { name: string; amount: number; cycle: string; lastCharged?: string }[];
  topMerchants: { name: string; total: number; count: number }[];
}

export const insightsPrompt = definePrompt<InsightsVars>({
  id: "insights.digest",
  version: 1,
  description: "Find waste, drift and lifestyle inflation in the month's spending.",
  tier: "balanced",
  temperature: 0.3,
  system: [
    HOUSE_RULES,
    "",
    "You surface patterns the user hasn't noticed. Be concrete and specific — a finding they could act on today.",
    "Do not repeat a detector alert verbatim; add the interpretation the detector can't.",
    "Skip anything you can't support with the figures provided. Fewer, sharper findings beat a long list.",
    "Output JSON only.",
  ].join("\n"),
  render: (vars) =>
    [
      `Currency: ${vars.currency}. Month: ${vars.month}.`,
      "",
      vars.alerts.length
        ? `Detector alerts already shown to the user (don't restate): ${vars.alerts
            .map((alert) => alert.title)
            .join("; ")}`
        : "No detector alerts fired.",
      "",
      `Category changes vs last month: ${JSON.stringify(vars.categoryChanges)}`,
      `Active subscriptions: ${JSON.stringify(vars.subscriptions)}`,
      `Top merchants this month: ${JSON.stringify(vars.topMerchants)}`,
      "",
      "Look for: creeping increases across several categories, subscriptions that duplicate each other, small frequent charges that add up, one-off spikes that will repeat, and anything that reads as lifestyle inflation.",
    ].join("\n"),
});

export interface BriefingVars {
  currency: string;
  today: string;
  facts: string;
}

export const briefingPrompt = definePrompt<BriefingVars>({
  id: "briefing.daily",
  version: 1,
  description: "A short proactive brief for the dashboard.",
  tier: "fast",
  temperature: 0.3,
  thinking: "off",
  system: [
    HOUSE_RULES,
    "",
    "Write 2 to 3 sentences the user reads over coffee. Lead with whatever is most time-sensitive.",
    "If nothing needs attention, say so in one sentence — a quiet day is a good report, not a reason to invent concern.",
  ].join("\n"),
  render: (vars) =>
    [`Today is ${vars.today}. Currency: ${vars.currency}.`, "", vars.facts].join("\n"),
});

export interface ExplainVars {
  subject: string;
  facts: string;
  currency: string;
}

export const explainPrompt = definePrompt<ExplainVars>({
  id: "explain.subject",
  version: 1,
  description: "Explain any number or recommendation the app is showing.",
  tier: "balanced",
  temperature: 0.2,
  system: [HOUSE_RULES, EXPLAIN_RULES].join("\n"),
  render: (vars) =>
    [
      `Currency: ${vars.currency}.`,
      `Explain, in 2 to 4 sentences: ${vars.subject}`,
      "",
      "Supporting data:",
      vars.facts,
      "",
      "Say what drives the number, and what would move it.",
    ].join("\n"),
});
