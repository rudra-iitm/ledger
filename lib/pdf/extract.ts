"use client";

/**
 * Text extraction from PDF statements via pdf.js (lazy-loaded).
 * Items are grouped into visual lines by their Y coordinate, then ordered
 * left-to-right — the shape lib/domain/ingest/pdf.ts expects.
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

export async function extractPdfLines(data: ArrayBuffer): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  const lines: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
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
      for (const [, items] of ordered) {
        lines.push(
          items
            .sort((a, b) => a.x - b.x)
            .map((item) => item.str)
            .join(" "),
        );
      }
    }
  } finally {
    await task.destroy();
  }
  return lines;
}
