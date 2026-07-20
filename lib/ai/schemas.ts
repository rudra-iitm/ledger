/**
 * Structured-output contracts.
 *
 * Each feature declares its shape twice, on purpose:
 *  - a **JSON Schema** sent to Gemini so decoding is constrained at the source;
 *  - a **Zod schema** applied to whatever actually comes back.
 *
 * The belt-and-braces is deliberate. Constrained decoding is not a guarantee —
 * a fallback model may not support `responseSchema`, and the request-body
 * degradation ladder in the transport will drop it rather than fail. Zod is
 * what makes "the model returned something odd" a typed error instead of a
 * crash three layers up.
 */

import { z } from "zod";
import { CATEGORIES, INCOME_CATEGORIES } from "@/lib/domain/types";
import type { JsonSchema } from "./provider";

export const CONFIDENCE = ["high", "medium", "low"] as const;
export const confidenceSchema = z.enum(CONFIDENCE);
export type Confidence = z.infer<typeof confidenceSchema>;

/* ------------------------------------------------------------------ */
/* Categorization                                                     */
/* ------------------------------------------------------------------ */

export const categorizeResultSchema = z.object({
  results: z.array(
    z.object({
      category: z.enum(CATEGORIES),
      confidence: confidenceSchema.default("medium"),
    }),
  ),
});
export type CategorizeResult = z.infer<typeof categorizeResultSchema>;

export const CATEGORIZE_JSON_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    results: {
      type: "array",
      description: "One entry per input description, in the same order.",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: [...CATEGORIES] },
          confidence: { type: "string", enum: [...CONFIDENCE] },
        },
        required: ["category", "confidence"],
      },
    },
  },
  required: ["results"],
};

/* ------------------------------------------------------------------ */
/* Document extraction                                                */
/* ------------------------------------------------------------------ */

export const DOCUMENT_KINDS = [
  "receipt",
  "invoice",
  "payslip",
  "statement",
  "other",
] as const;

const nullableNumber = z.number().nullable().optional();
const nullableString = z.string().nullable().optional();

export const documentExtractionSchema = z.object({
  documentKind: z.enum(DOCUMENT_KINDS).default("other"),
  merchant: nullableString,
  date: nullableString,
  totalAmount: nullableNumber,
  currency: nullableString,
  taxAmount: nullableNumber,
  category: z.enum(CATEGORIES).nullable().optional(),
  incomeCategory: z.enum(INCOME_CATEGORIES).nullable().optional(),
  /** Set for payslips, where the document represents money coming in. */
  direction: z.enum(["debit", "credit"]).default("debit"),
  paymentMethod: nullableString,
  referenceNumber: nullableString,
  lineItems: z
    .array(
      z.object({
        description: z.string(),
        amount: z.number().nullable().optional(),
        quantity: z.number().nullable().optional(),
      }),
    )
    .default([]),
  confidence: confidenceSchema.default("medium"),
  /** What the model could not read — surfaced in the verification UI. */
  warnings: z.array(z.string()).default([]),
});
export type DocumentExtraction = z.infer<typeof documentExtractionSchema>;

export const DOCUMENT_JSON_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    documentKind: { type: "string", enum: [...DOCUMENT_KINDS] },
    merchant: { type: "string", description: "Who was paid, or the employer for a payslip." },
    date: { type: "string", description: "YYYY-MM-DD." },
    totalAmount: { type: "number", description: "The payable total, or net pay for a payslip." },
    currency: { type: "string", description: "Currency symbol or ISO code as printed." },
    taxAmount: { type: "number", description: "GST/VAT/tax if itemised." },
    category: { type: "string", enum: [...CATEGORIES] },
    incomeCategory: { type: "string", enum: [...INCOME_CATEGORIES] },
    direction: { type: "string", enum: ["debit", "credit"] },
    paymentMethod: { type: "string" },
    referenceNumber: { type: "string" },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          amount: { type: "number" },
          quantity: { type: "number" },
        },
        required: ["description"],
      },
    },
    confidence: { type: "string", enum: [...CONFIDENCE] },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Anything illegible, cropped or ambiguous.",
    },
  },
  required: ["documentKind", "confidence"],
};

/* ------------------------------------------------------------------ */
/* Health advice                                                      */
/* ------------------------------------------------------------------ */

export const healthAdviceSchema = z.object({
  headline: z.string(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  actions: z
    .array(
      z.object({
        title: z.string(),
        reasoning: z.string(),
        component: z.string(),
        impact: z.enum(["high", "medium", "low"]).default("medium"),
      }),
    )
    .default([]),
});
export type HealthAdvice = z.infer<typeof healthAdviceSchema>;

export const HEALTH_ADVICE_JSON_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    headline: { type: "string", description: "One sentence on where they stand." },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    actions: {
      type: "array",
      description: "At most three, ranked by impact on the score.",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "The action, as an imperative." },
          reasoning: { type: "string", description: "Why, citing the figures." },
          component: { type: "string", description: "Which health component it improves." },
          impact: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["title", "reasoning", "component", "impact"],
      },
    },
  },
  required: ["headline", "actions"],
};

/* ------------------------------------------------------------------ */
/* Spending insights                                                  */
/* ------------------------------------------------------------------ */

export const INSIGHT_KINDS = [
  "waste",
  "drift",
  "duplicate",
  "spike",
  "opportunity",
  "pattern",
] as const;

export const insightsSchema = z.object({
  findings: z
    .array(
      z.object({
        kind: z.enum(INSIGHT_KINDS),
        title: z.string(),
        detail: z.string(),
        evidence: z.string(),
        estimatedMonthlySaving: z.number().nullable().optional(),
        confidence: confidenceSchema.default("medium"),
      }),
    )
    .default([]),
});
export type InsightFindings = z.infer<typeof insightsSchema>;

export const INSIGHTS_JSON_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      description: "At most five. Omit anything the data doesn't support.",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: [...INSIGHT_KINDS] },
          title: { type: "string", description: "Six words or fewer." },
          detail: { type: "string", description: "One or two sentences." },
          evidence: { type: "string", description: "The figures this rests on." },
          estimatedMonthlySaving: {
            type: "number",
            description: "Only when it follows directly from the figures.",
          },
          confidence: { type: "string", enum: [...CONFIDENCE] },
        },
        required: ["kind", "title", "detail", "evidence", "confidence"],
      },
    },
  },
  required: ["findings"],
};
