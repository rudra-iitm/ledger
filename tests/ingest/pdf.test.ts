import { describe, expect, it } from "vitest";
import { parseStatementLines } from "@/lib/domain/ingest/pdf";

describe("parseStatementLines", () => {
  it("parses amount+balance layouts using the running balance for direction", () => {
    const lines = [
      "Statement of account — July 2026",
      "Date Narration Amount Balance",
      "01/07/2026 OPENING BALANCE 0.00 50,000.00",
      "02/07/2026 UPI-SWIGGY-swiggy@icici-412345678901 450.00 49,550.00",
      "05/07/2026 SALARY JUL ACME CORP 1,50,000.00 1,99,550.00",
      "Page 1 of 1",
    ];
    const { rows } = parseStatementLines(lines);
    const meaningful = rows.filter((row) => row.description !== "OPENING BALANCE");
    expect(meaningful).toHaveLength(2);
    expect(meaningful[0]).toMatchObject({
      date: "2026-07-02",
      amount: 450,
      direction: "debit",
      refNo: "412345678901",
      balance: 49550,
    });
    expect(meaningful[1]).toMatchObject({
      date: "2026-07-05",
      amount: 150000,
      direction: "credit",
    });
  });

  it("respects explicit Cr/Dr markers", () => {
    const lines = [
      "02/07/2026 AMAZON PAY INDIA 1,299.00 Dr",
      "03/07/2026 REFUND AMAZON 1,299.00 Cr",
    ];
    const { rows } = parseStatementLines(lines);
    expect(rows[0].direction).toBe("debit");
    expect(rows[1].direction).toBe("credit");
  });

  it("joins wrapped narration lines onto the transaction", () => {
    const lines = [
      "02/07/2026 NEFT-N12345-BIG VENDOR PRIVATE",
      "LIMITED-INVOICE 42 12,000.00 38,000.00",
    ];
    const { rows } = parseStatementLines(lines);
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toContain("BIG VENDOR PRIVATE LIMITED");
    expect(rows[0].amount).toBe(12000);
  });

  it("skips noise lines without dates or amounts", () => {
    const { rows, skipped } = parseStatementLines([
      "HDFC BANK LTD",
      "This is a system generated statement",
      "01/07/2026 SOME NOTE WITHOUT AMOUNT",
    ]);
    expect(rows).toHaveLength(0);
    expect(skipped).toBe(1);
  });
});
