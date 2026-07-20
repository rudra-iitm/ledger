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

describe("collectStatementPasswords", () => {
  const account = (id: string, name: string, statementPassword?: string) => ({
    id, name, statementPassword,
    type: "bank" as const, balance: 0, openingBalance: 0, icon: "🏦",
    archived: false, debitCards: [], reconciliations: [],
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  it("dedupes by value and puts the preferred account first", async () => {
    const { collectStatementPasswords } = await import(
      "@/lib/domain/ingest/pdf"
    );
    const accounts = [
      account("a1", "HDFC", "PAN1234"),
      account("a2", "ICICI", "DOB0101"),
      account("a3", "Axis", "PAN1234"), // duplicate value
      account("a4", "Cash"), // none
    ];
    const result = collectStatementPasswords(accounts, "a2");
    expect(result.map((entry) => entry.accountName)).toEqual(["ICICI", "HDFC"]);
    expect(result.map((entry) => entry.password)).toEqual([
      "DOB0101",
      "PAN1234",
    ]);
  });
});

describe("numbered debit/credit/balance tables (BoB-style)", () => {
  // Anonymized replica of the real layout: bilingual headers, serial-numbered
  // anchors, dash-marked empty columns, descriptions wrapped above/below.
  const line = (page: number, y: number, text: string) => ({ page, y, text });
  const lines = [
    line(1, 780, "Account Statement from 01-07-2026 to 10-07-2026"),
    line(1, 760, "क.सं लेनदेन की पभाव तारीख ववरण चेक नंबर नामे जमा शेष"),
    line(1, 748, "Cheque Debit Credit Balance"),
    line(1, 736, "Sr.No Transaction Value Description"),
    line(1, 724, "Date Date"),
    line(1, 700, "1 01-07-2026 Opening Balance - - 50,000.00"),
    line(1, 689, "UPI/126215190907/12:33:16/UPI/vendor1@axl/U"),
    line(1, 678, "2 01-07-2026 01-07-2026 450.00 - 49,550.00"),
    line(1, 667, "PI"),
    line(1, 656, "IMPS/P2A/619446142209/Some Person/IMPS"),
    line(1, 645, "3 02-07-2026 02-07-2026 - 10,000.00 59,550.00"),
    line(1, 634, "transa"),
    line(1, 623, "UPI/126254921643/08:19:52/UPI/someone2003@"),
    line(1, 612, "4 03-07-2026 03-07-2026 75.00 - 59,475.00"),
    line(1, 601, "oks"),
    line(1, 560, "Page 1 of 2"),
    line(2, 780, "Account Statement from 01-07-2026 to 10-07-2026"),
    line(2, 748, "Cheque Debit Credit Balance"),
    line(2, 700, "UPI/103687132339/14:21:25/UPI/merchant@h"),
    line(2, 689, "5 04-07-2026 04-07-2026 1,200.00 - 58,275.00"),
    line(2, 640, "This is a computer-generated statement hence does not require signature."),
  ];

  it("parses anchors, reattaches wrapped descriptions, and reads dash columns", () => {
    const { rows } = parseStatementLines(lines);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      date: "2026-07-01",
      amount: 450,
      direction: "debit",
      balance: 49550,
      refNo: "126215190907",
    });
    // Wrapped VPA joined without spaces: "...@" + "oks"
    expect(rows[2].description).toContain("someone2003@oks");
    expect(rows[1]).toMatchObject({ direction: "credit", amount: 10000 });
    // Opening-balance row seeds the chain but is not a transaction
    expect(rows.every((row) => !/opening balance/i.test(row.description))).toBe(true);
    // Page-2 row unaffected by page-1 geometry
    expect(rows[3]).toMatchObject({ date: "2026-07-04", amount: 1200, direction: "debit" });
  });

  it("keeps page chrome out of descriptions", () => {
    const { rows } = parseStatementLines(lines);
    for (const row of rows) {
      expect(row.description).not.toMatch(/page \d|debit credit balance|sr\.no/i);
    }
  });
});
