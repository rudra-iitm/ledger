import { describe, expect, it } from "vitest";
import {
  isSupportedDocument,
  isUsable,
  MAX_FILE_BYTES,
  toCapture,
} from "@/lib/ai/features/documents";
import { documentLineHash, documentToDraft } from "@/lib/domain/ingest/document";
import { documentExtractionSchema, type DocumentExtraction } from "@/lib/ai/schemas";

const NOW = new Date("2026-07-20T00:00:00.000Z");

function extraction(over: Partial<DocumentExtraction> = {}): DocumentExtraction {
  return documentExtractionSchema.parse({
    documentKind: "receipt",
    merchant: "Blinkit",
    date: "2026-07-18",
    totalAmount: 842.5,
    confidence: "high",
    ...over,
  });
}

describe("file gating", () => {
  it("accepts the formats a phone and a bank actually produce", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
      expect(isSupportedDocument({ type } as File)).toBe(true);
    }
  });

  it("rejects everything else, so nothing unreadable is uploaded", () => {
    for (const type of ["text/csv", "application/zip", "video/mp4", ""]) {
      expect(isSupportedDocument({ type } as File)).toBe(false);
    }
  });

  it("keeps the size cap inside Gemini's inline budget after base64 inflation", () => {
    // base64 adds ~33%; the API limit is 20 MB.
    expect(MAX_FILE_BYTES * 1.34).toBeLessThan(20 * 1024 * 1024);
  });
});

describe("isUsable", () => {
  it("requires a positive total before anything can be saved", () => {
    expect(isUsable(extraction())).toBe(true);
    expect(isUsable(extraction({ totalAmount: null }))).toBe(false);
    expect(isUsable(extraction({ totalAmount: 0 }))).toBe(false);
    expect(isUsable(extraction({ totalAmount: -5 }))).toBe(false);
  });
});

describe("toCapture", () => {
  it("maps a clean extraction onto the neutral capture shape", () => {
    const capture = toCapture(extraction(), "receipt.jpg", NOW);
    expect(capture).toMatchObject({
      date: "2026-07-18",
      amount: 842.5,
      direction: "debit",
      description: "Blinkit",
    });
    expect(capture.sourceLabel).toContain("receipt.jpg");
  });

  it("falls back to the keyword classifier when no category was read", () => {
    const capture = toCapture(
      extraction({ merchant: "Swiggy order 4412", category: null }),
      "x.jpg",
      NOW,
    );
    expect(capture.category).toBe("Food");
  });

  it("falls back to today when the document has no readable date", () => {
    const capture = toCapture(extraction({ date: null }), "x.jpg", NOW);
    expect(capture.date).toBe("2026-07-20");
  });

  it("falls back to the file name when no merchant was read", () => {
    const capture = toCapture(extraction({ merchant: null }), "bill-april.pdf", NOW);
    expect(capture.description).toBe("bill-april");
  });

  it("carries line items and tax into the note rather than losing them", () => {
    const capture = toCapture(
      extraction({
        lineItems: [{ description: "Milk", amount: 60 }, { description: "Bread", amount: 45 }],
        taxAmount: 12.5,
        paymentMethod: "UPI",
      }),
      "x.jpg",
      NOW,
    );
    expect(capture.notes).toContain("Milk — 60");
    expect(capture.notes).toContain("Tax: 12.5");
    expect(capture.notes).toContain("Paid by: UPI");
  });

  it("treats a payslip as money coming in", () => {
    const capture = toCapture(
      extraction({ documentKind: "payslip", direction: "credit", incomeCategory: "Salary" }),
      "payslip.pdf",
      NOW,
    );
    expect(capture.direction).toBe("credit");
    expect(capture.incomeCategory).toBe("Salary");
  });

  it("refuses to build a capture with no total", () => {
    expect(() => toCapture(extraction({ totalAmount: null }), "x.jpg", NOW)).toThrow();
  });
});

describe("documentToDraft", () => {
  it("produces a pending draft, never a ledger row", () => {
    const draft = documentToDraft(
      toCapture(extraction(), "receipt.jpg", NOW),
      "draft-1",
      NOW.toISOString(),
      "acc-bank",
    );
    expect(draft.status).toBe("pending");
    expect(draft.batchId).toBe("document");
    expect(draft.accountId).toBe("acc-bank");
    expect(draft.suggestedType).toBe("expense");
  });

  it("routes a credit document to the income side", () => {
    const draft = documentToDraft(
      toCapture(
        extraction({ direction: "credit", incomeCategory: "Salary" }),
        "payslip.pdf",
        NOW,
      ),
      "draft-2",
      NOW.toISOString(),
    );
    expect(draft.suggestedType).toBe("income");
    expect(draft.suggestedIncomeCategory).toBe("Salary");
  });

  it("hashes identically for the same document, so a rescan dedupes", () => {
    const first = toCapture(extraction(), "receipt.jpg", NOW);
    const second = toCapture(extraction(), "receipt-copy.jpg", NOW);
    // The file name is provenance, not identity — the money is the identity.
    expect(documentLineHash(first)).toBe(documentLineHash(second));
  });

  it("hashes differently when the amount differs", () => {
    expect(documentLineHash(toCapture(extraction(), "a.jpg", NOW))).not.toBe(
      documentLineHash(toCapture(extraction({ totalAmount: 843 }), "a.jpg", NOW)),
    );
  });
});
