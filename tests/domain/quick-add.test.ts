import { describe, expect, it } from "vitest";
import { parseQuickAdd, resolveAccountHint } from "@/lib/domain/quick-add";
import { parseCaptureText } from "@/lib/domain/ingest/capture";

describe("parseQuickAdd v2", () => {
  it("parses the classic forms", () => {
    expect(parseQuickAdd("lunch 450")).toMatchObject({
      description: "lunch",
      amount: 450,
      category: "Food",
      tags: [],
      dayOffset: 0,
    });
    expect(parseQuickAdd("rs. 1,200 groceries")).toMatchObject({
      amount: 1200,
      category: "Food",
    });
  });

  it("extracts non-category hashtags as tags", () => {
    expect(parseQuickAdd("#food chai 30")).toMatchObject({
      category: "Food",
      tags: [],
    });
    expect(parseQuickAdd("chai 30 #office #trip-goa")).toMatchObject({
      description: "chai",
      tags: ["office", "trip-goa"],
    });
  });

  it("understands @account hints and yesterday", () => {
    const parsed = parseQuickAdd("uber 280 @hdfc yesterday");
    expect(parsed).toMatchObject({
      description: "uber",
      amount: 280,
      category: "Travel",
      accountHint: "hdfc",
      dayOffset: -1,
    });
  });

  it("still rejects unparseable input", () => {
    expect(parseQuickAdd("")).toBeNull();
    expect(parseQuickAdd("just words")).toBeNull();
    expect(parseQuickAdd("450")).toBeNull();
  });
});

describe("resolveAccountHint", () => {
  const accounts = [
    { id: "a1", name: "HDFC Savings", archived: false },
    { id: "a2", name: "Cash", archived: false },
    { id: "a3", name: "Old HDFC", archived: true },
  ];
  it("matches by case-insensitive substring, skipping archived", () => {
    expect(resolveAccountHint("hdfc", accounts)?.id).toBe("a1");
    expect(resolveAccountHint("cash", accounts)?.id).toBe("a2");
    expect(resolveAccountHint("sbi", accounts)).toBeNull();
    expect(resolveAccountHint(undefined, accounts)).toBeNull();
  });
});

describe("parseCaptureText", () => {
  it("parses a typical debit SMS", () => {
    const parsed = parseCaptureText(
      "Rs.450.00 debited from HDFC Bank A/c XX1234 on 19-Jul-26 to VPA swiggy@icici UPI Ref 521345678901. Not you? Call 18002586161",
    );
    expect(parsed).toMatchObject({
      amount: 450,
      direction: "debit",
      date: "2026-07-19",
      suggestedType: "expense",
      suggestedCategory: "Food",
      accountLast4: "1234",
      vpa: "swiggy@icici",
    });
    expect(parsed?.description).toBe("Swiggy");
  });

  it("parses credit / refund messages", () => {
    const refund = parseCaptureText(
      "INR 1,299.00 credited to A/c XX1234 on 15/07/2026 towards refund from AMAZON",
    );
    expect(refund).toMatchObject({
      amount: 1299,
      direction: "credit",
      suggestedType: "income",
      suggestedIncomeCategory: "Refunds",
    });
  });

  it("falls back to today when no date is present and rejects non-payments", () => {
    const parsed = parseCaptureText("Paid ₹120 to chai wala");
    expect(parsed?.amount).toBe(120);
    expect(parsed?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parseCaptureText("Your OTP is 482910")).toBeNull();
    expect(parseCaptureText("")).toBeNull();
  });
});
