"use client";

import type { PdfLine } from "@/lib/domain/ingest/pdf";

/**
 * Text extraction from PDF statements via pdf.js (lazy-loaded).
 * Items are grouped into visual lines by their Y coordinate, ordered
 * left-to-right, and returned with their page + Y position so the domain
 * parser can reattach wrapped table cells to their rows.
 */

interface PositionedText {
  x: number;
  str: string;
}

function isTextItem(item: unknown): item is { str: string; transform: number[] } {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    typeof (item as { str: unknown }).str === "string" &&
    "transform" in item
  );
}

/** The document is encrypted: no password given, or the given one is wrong. */
export class PdfPasswordError extends Error {
  constructor(public readonly incorrect: boolean) {
    super(incorrect ? "Incorrect PDF password" : "PDF requires a password");
    this.name = "PdfPasswordError";
  }
}

function isPasswordException(
  error: unknown,
): error is { name: string; code: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: string }).name === "PasswordException"
  );
}

export async function extractPdfLines(
  data: ArrayBuffer,
  password?: string,
): Promise<PdfLine[]> {
  // The legacy build is compiled + polyfilled for older engines. The modern
  // build assumes APIs like Promise.withResolvers that iOS Safari < 17.4
  // lacks — on those devices extraction died with
  // "TypeError: undefined is not a function" after unlocking.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  // pdf.js transfers the buffer to its worker — hand it a copy so the
  // caller can retry with another password on the same bytes.
  const task = pdfjs.getDocument({ data: data.slice(0), password });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (error) {
    if (isPasswordException(error)) {
      // pdf.js: code 1 = password needed, 2 = incorrect password.
      throw new PdfPasswordError(error.code === 2 || Boolean(password));
    }
    throw error;
  }
  const lines: PdfLine[] = [];
  let lastPageError: unknown = null;
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      let content: Awaited<ReturnType<Awaited<ReturnType<typeof doc.getPage>>["getTextContent"]>>;
      try {
        const page = await doc.getPage(pageNumber);
        content = await page.getTextContent();
      } catch (error) {
        // One broken page (bad font, damaged stream) shouldn't sink the
        // whole statement — parse what the readable pages give us.
        console.error(`pdf extract: page ${pageNumber} failed`, error);
        lastPageError = error;
        continue;
      }
      const rows = new Map<number, PositionedText[]>();
      for (const item of content.items) {
        if (!isTextItem(item) || !item.str.trim()) continue;
        const y = Math.round(item.transform[5]);
        let key = y;
        for (const existing of rows.keys()) {
          if (Math.abs(existing - y) <= 2) {
            key = existing;
            break;
          }
        }
        const bucket = rows.get(key) ?? [];
        bucket.push({ x: item.transform[4], str: item.str });
        rows.set(key, bucket);
      }
      const ordered = [...rows.entries()].sort((a, b) => b[0] - a[0]);
      for (const [y, items] of ordered) {
        lines.push({
          page: pageNumber,
          y,
          text: items
            .sort((a, b) => a.x - b.x)
            .map((item) => item.str)
            .join(" "),
        });
      }
    }
  } finally {
    await task.destroy();
  }
  if (lines.length === 0 && lastPageError) throw lastPageError;
  return lines;
}
