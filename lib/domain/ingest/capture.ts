import type { Category, IncomeCategory } from "../types";
import { resolveBrand } from "../../brands/registry";
import { todayISO } from "../dates";
import { inferCategory } from "../quick-add";
import { parseStatementDate } from "./csv";
import { decodeNarration } from "./narration";

/**
 * Parser for shared/pasted payment text — bank SMS, UPI app messages,
 * forwarded confirmations. Best-effort by design: anything parseable
 * becomes an Inbox draft the user confirms.
 */

export interface CaptureParse {
  amount: number;
  direction: "debit" | "credit";
  date: string;
  description: string;
  channel?: string;
  refNo?: string;
  vpa?: string;
  accountLast4?: string;
  suggestedType: "expense" | "income";
  suggestedCategory: Category;
  suggestedIncomeCategory?: IncomeCategory;
}

const AMOUNT_PATTERNS = [
  /(?:rs\.?|inr|₹)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i,
  /([\d,]+\.\d{2})\s*(?:rs\.?|inr)/i,
];

const DATE_PATTERN =
  /\b(\d{1,2}[-/][A-Za-z]{3}[-/]?\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/;

export function parseCaptureText(
  input: string,
  now: Date = new Date(),
): CaptureParse | null {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return null;

  let amount: number | null = null;
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const value = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(value) && value > 0) {
        amount = value;
        break;
      }
    }
  }
  if (amount === null) return null;

  const credit =
    /\b(credited|received|deposited|refund(?:ed)?)\b/i.test(text) &&
    !/\b(debited|spent)\b/i.test(text);

  const dateMatch = text.match(DATE_PATTERN);
  const date =
    (dateMatch ? parseStatementDate(dateMatch[1]) : null) ?? todayISO(now);

  const decoded = decodeNarration(text);
  const brand = resolveBrand(text);
  const toMatch = text.match(
    /\b(?:to|at|towards|info:)\s*[:-]?\s*([A-Za-z][A-Za-z0-9 &._-]{2,40}?)(?=\s+(?:on|via|ref|upi|a\/c|avl|bal|not you|-|\.)|$)/i,
  );
  const description =
    brand?.name ??
    decoded.counterparty ??
    toMatch?.[1]?.trim() ??
    (decoded.vpa ? decoded.vpa.split("@")[0] : "Captured payment");

  const accountMatch = text.match(
    /a\/?c(?:count)?\s*(?:no\.?)?\s*[xX*]*(\d{3,6})/i,
  );

  if (credit) {
    return {
      amount,
      direction: "credit",
      date,
      description,
      channel: decoded.channel,
      refNo: decoded.refNo,
      vpa: decoded.vpa,
      accountLast4: accountMatch?.[1],
      suggestedType: "income",
      suggestedCategory: "Other",
      suggestedIncomeCategory: /refund/i.test(text)
        ? "Refunds"
        : /salary/i.test(text)
          ? "Salary"
          : "Other",
    };
  }

  return {
    amount,
    direction: "debit",
    date,
    description,
    channel: decoded.channel,
    refNo: decoded.refNo,
    vpa: decoded.vpa,
    accountLast4: accountMatch?.[1],
    suggestedType: "expense",
    suggestedCategory: brand?.category ?? inferCategory(description),
  };
}
