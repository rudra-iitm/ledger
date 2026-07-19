import { describe, expect, it } from "vitest";
import {
  computeLineHash,
  guessMapping,
  parseCsv,
  parseStatementAmount,
  parseStatementCsv,
  parseStatementDate,
  type StatementRow,
} from "@/lib/domain/ingest/csv";

describe("parseCsv", () => {
  it("handles quoted fields, escaped quotes, and CRLF", () => {
    const text = 'a,"b, with comma","say ""hi"""\r\n1,2,3\n';
    expect(parseCsv(text)).toEqual([
      ["a", "b, with comma", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });

  it("skips blank lines", () => {
    expect(parseCsv("a,b\n\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseStatementDate", () => {
  it("parses day-first numeric formats", () => {
    expect(parseStatementDate("31/01/2026")).toBe("2026-01-31");
    expect(parseStatementDate("05-07-26")).toBe("2026-07-05");
  });

  it("parses ISO and month-name formats", () => {
    expect(parseStatementDate("2026-07-05")).toBe("2026-07-05");
    expect(parseStatementDate("05 Jul 2026")).toBe("2026-07-05");
    expect(parseStatementDate("5-Jul-26")).toBe("2026-07-05");
  });

  it("rejects garbage", () => {
    expect(parseStatementDate("hello")).toBeNull();
    expect(parseStatementDate("13/13/2026")).toBeNull();
    expect(parseStatementDate("")).toBeNull();
  });
});

describe("parseStatementAmount", () => {
  it("parses Indian formatting and symbols", () => {
    expect(parseStatementAmount("1,23,456.78")).toBe(123456.78);
    expect(parseStatementAmount("₹500")).toBe(500);
  });

  it("understands CR/DR markers and parentheses", () => {
    expect(parseStatementAmount("500 CR")).toBe(500);
    expect(parseStatementAmount("500 DR")).toBe(-500);
    expect(parseStatementAmount("(120)")).toBe(-120);
    expect(parseStatementAmount("-42.5")).toBe(-42.5);
  });

  it("rejects non-amounts", () => {
    expect(parseStatementAmount("")).toBeNull();
    expect(parseStatementAmount("abc")).toBeNull();
  });
});

describe("guessMapping", () => {
  it("recognizes HDFC-style headers", () => {
    const mapping = guessMapping([
      "Date",
      "Narration",
      "Chq./Ref.No.",
      "Value Dt",
      "Withdrawal Amt.",
      "Deposit Amt.",
      "Closing Balance",
    ]);
    expect(mapping).toMatchObject({
      dateCol: 0,
      descCol: 1,
      refCol: 2,
      debitCol: 4,
      creditCol: 5,
      balanceCol: 6,
    });
  });

  it("returns null without a recognizable date or amount", () => {
    expect(guessMapping(["foo", "bar"])).toBeNull();
  });
});

describe("parseStatementCsv", () => {
  const text = [
    "Date,Narration,Withdrawal,Deposit,Balance",
    "01/07/2026,UPI-SWIGGY-swiggy@icici-412345678901,450.00,,9550.00",
    "02/07/2026,SALARY JUL ACME CORP,,150000.00,159550.00",
    "bad row,,,,",
  ].join("\n");
  const mapping = {
    dateCol: 0,
    descCol: 1,
    debitCol: 2,
    creditCol: 3,
    balanceCol: 4,
    hasHeader: true,
  };

  it("produces normalized rows with directions and balance", () => {
    const { rows, skipped } = parseStatementCsv(text, mapping);
    expect(rows).toHaveLength(2);
    expect(skipped).toBe(1);
    expect(rows[0]).toMatchObject({
      date: "2026-07-01",
      amount: 450,
      direction: "debit",
      balance: 9550,
    });
    expect(rows[1]).toMatchObject({
      date: "2026-07-02",
      amount: 150000,
      direction: "credit",
    });
  });

  it("supports signed single-amount columns", () => {
    const signed = "Date,Description,Amount\n01/07/2026,Coffee,-300\n02/07/2026,Refund,120";
    const { rows } = parseStatementCsv(signed, {
      dateCol: 0,
      descCol: 1,
      amountCol: 2,
      hasHeader: true,
    });
    expect(rows[0]).toMatchObject({ amount: 300, direction: "debit" });
    expect(rows[1]).toMatchObject({ amount: 120, direction: "credit" });
  });
});

describe("computeLineHash", () => {
  const row: StatementRow = {
    date: "2026-07-01",
    description: "UPI-SWIGGY-swiggy@icici-412345678901",
    amount: 450,
    direction: "debit",
    refNo: "412345678901",
  };

  it("is stable across whitespace/case noise", () => {
    const noisy = { ...row, description: "  UPI-Swiggy-swiggy@icici-412345678901 " };
    expect(computeLineHash("acc", row)).toBe(computeLineHash("acc", noisy));
  });

  it("differs by account, amount, and date", () => {
    expect(computeLineHash("acc", row)).not.toBe(computeLineHash("acc2", row));
    expect(computeLineHash("acc", { ...row, amount: 451 })).not.toBe(
      computeLineHash("acc", row),
    );
    expect(computeLineHash("acc", { ...row, date: "2026-07-02" })).not.toBe(
      computeLineHash("acc", row),
    );
  });
});
