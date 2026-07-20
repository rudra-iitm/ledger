"use client";

/**
 * Document understanding.
 *
 * Receipts, invoices, payslips and statement scans go to a multimodal model
 * and come back as typed data. This is the AI job the doctrine in
 * docs/product-analysis/04 calls ideal: bounded, verifiable, and genuinely
 * beyond what a parser can do.
 *
 * The output is never trusted. It lands in a verification UI, the user edits
 * anything wrong, and only then does it become an inbox draft — which still
 * has to be confirmed. Two gates before a scanned number reaches the ledger.
 */

import { inferCategory } from "@/lib/domain/quick-add";
import { todayISO } from "@/lib/domain/dates";
import type { DocumentCapture } from "@/lib/domain/ingest/document";
import { CATEGORIES, type Category } from "@/lib/domain/types";
import { TTL } from "../cache";
import { runJson } from "../client";
import { documentPrompt, type DocumentKind } from "../prompts";
import { featureId } from "../prompts/registry";
import { AiError } from "../provider";
import {
  documentExtractionSchema,
  DOCUMENT_JSON_SCHEMA,
  type DocumentExtraction,
} from "../schemas";

/** What Gemini accepts inline, intersected with what a phone produces. */
export const SUPPORTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

/**
 * 8 MB of raw bytes. Inline data is base64, which inflates by ~4/3, keeping
 * the request comfortably inside Gemini's 20 MB limit.
 */
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

export function isSupportedDocument(file: File): boolean {
  return (SUPPORTED_TYPES as readonly string[]).includes(file.type);
}

/**
 * Read a File as base64 without the `data:` prefix.
 *
 * FileReader rather than a manual Uint8Array walk: large receipts blow the
 * call stack when spread into `String.fromCharCode`.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new AiError("Couldn't read that file.", "response"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export interface ExtractOptions {
  file: File;
  hint?: DocumentKind | "auto";
  now?: Date;
  signal?: AbortSignal;
}

/** Validate, encode, extract. Throws `AiError` with a message worth showing. */
export async function extractDocument(
  options: ExtractOptions,
): Promise<DocumentExtraction> {
  const { file } = options;

  if (!file.size) {
    throw new AiError("That file is empty.", "invalid-output");
  }
  if (!isSupportedDocument(file)) {
    throw new AiError(
      `${file.type || "That file type"} isn't supported — use a JPEG, PNG, WebP or PDF.`,
      "invalid-output",
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new AiError(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 8 MB.`,
      "invalid-output",
    );
  }

  const data = await fileToBase64(file);
  const now = options.now ?? new Date();

  const { value } = await runJson(
    {
      feature: featureId(documentPrompt),
      tier: documentPrompt.tier,
      system: documentPrompt.system,
      temperature: documentPrompt.temperature,
      schema: DOCUMENT_JSON_SCHEMA,
      messages: [
        {
          role: "user",
          parts: [
            { text: documentPrompt.render({ hint: options.hint ?? "auto", today: todayISO(now) }) },
            { inlineData: { mimeType: file.type, data } },
          ],
        },
      ],
      // A document's contents never change, so a re-scan of the same file is
      // free — which matters when the user retries after fixing a field.
      cacheTtlSeconds: TTL.long,
      signal: options.signal,
      maxOutputTokens: 2048,
    },
    documentExtractionSchema,
  );

  return value;
}

/** True when the extraction is complete enough to become a draft. */
export function isUsable(extraction: DocumentExtraction): boolean {
  return typeof extraction.totalAmount === "number" && extraction.totalAmount > 0;
}

function safeCategory(extraction: DocumentExtraction): Category {
  if (extraction.category && CATEGORIES.includes(extraction.category)) {
    return extraction.category;
  }
  // Fall back to the deterministic keyword classifier rather than "Other":
  // it already knows a few hundred Indian merchants.
  return inferCategory(extraction.merchant ?? "");
}

function notesFrom(extraction: DocumentExtraction): string | undefined {
  const parts: string[] = [];
  if (extraction.lineItems.length) {
    parts.push(
      extraction.lineItems
        .slice(0, 20)
        .map((item) =>
          item.amount != null
            ? `${item.description} — ${item.amount}`
            : item.description,
        )
        .join("\n"),
    );
  }
  if (extraction.taxAmount != null) parts.push(`Tax: ${extraction.taxAmount}`);
  if (extraction.paymentMethod) parts.push(`Paid by: ${extraction.paymentMethod}`);
  return parts.length ? parts.join("\n") : undefined;
}

/**
 * Turn a (possibly user-edited) extraction into the neutral capture shape the
 * store accepts. Throws if the amount is still missing — the UI blocks the
 * button on `isUsable`, so reaching this is a bug rather than a user error.
 */
export function toCapture(
  extraction: DocumentExtraction,
  fileName: string,
  now: Date = new Date(),
): DocumentCapture {
  if (!isUsable(extraction)) {
    throw new AiError("This document has no readable total.", "invalid-output");
  }
  return {
    date: extraction.date ?? todayISO(now),
    amount: extraction.totalAmount as number,
    direction: extraction.direction,
    description: extraction.merchant?.trim() || fileName.replace(/\.[^.]+$/, ""),
    category: safeCategory(extraction),
    incomeCategory: extraction.incomeCategory ?? undefined,
    referenceNumber: extraction.referenceNumber ?? undefined,
    sourceLabel: `Scanned document — ${fileName}`,
    notes: notesFrom(extraction),
  };
}
