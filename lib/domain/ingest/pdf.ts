import { parseStatementAmount, parseStatementDate, type StatementRow } from "./csv";

/**
 * Heuristic parser for text lines extracted from PDF bank/card statements.
 *
 * Works on the common Indian layout: each transaction line starts with a
 * date, ends with 1–3 money tokens (amount / amount+balance), and wrapped
 * narration lines carry no date. Direction comes from, in priority order:
 * an explicit Cr/Dr marker, the running-balance delta, or debit-by-default.
 */

const DATE_HEAD =
  /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3}[a-z]*\s+\d{2,4})\b[.,]?\s*(.*)$/;
const MONEY = /\d[\d,]*\.\d{2}/g;
const MARKER = /\b(cr|dr)\.?\b/i;

interface RawTxn {
  date: string;
  text: string;
}

export interface PdfParseResult {
  rows: StatementRow[];
  skipped: number;
}

export function parseStatementLines(lines: string[]): PdfParseResult {
  const txns: RawTxn[] = [];
  let skipped = 0;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const head = line.match(DATE_HEAD);
    if (head) {
      const date = parseStatementDate(head[1]);
      if (date) {
        txns.push({ date, text: head[2] });
        continue;
      }
    }
    // Continuation of the previous narration (no leading date). Lines with
    // money tokens are kept too — some layouts push amounts to a second line.
    const last = txns[txns.length - 1];
    if (last) last.text += ` ${line}`;
  }

  const rows: StatementRow[] = [];
  let previousBalance: number | null = null;

  for (const txn of txns) {
    const moneyTokens = [...txn.text.matchAll(MONEY)].map((match) => ({
      value: match[0],
      index: match.index ?? 0,
    }));
    if (moneyTokens.length === 0) {
      skipped += 1;
      continue;
    }

    const balanceToken = moneyTokens.length >= 2 ? moneyTokens.at(-1) : undefined;
    const amountToken =
      moneyTokens.length >= 2 ? moneyTokens.at(-2)! : moneyTokens[0];
    const amount = parseStatementAmount(amountToken.value);
    const balance = balanceToken
      ? parseStatementAmount(balanceToken.value)
      : null;
    if (!amount || amount === 0) {
      skipped += 1;
      continue;
    }

    // Text after the amount often carries the Cr/Dr marker.
    const tail = txn.text.slice(amountToken.index + amountToken.value.length);
    const markerMatch = tail.match(MARKER) ?? txn.text.match(MARKER);

    let direction: "debit" | "credit";
    if (markerMatch) {
      direction = markerMatch[1].toLowerCase() === "cr" ? "credit" : "debit";
    } else if (balance !== null && previousBalance !== null) {
      direction = balance < previousBalance ? "debit" : "credit";
    } else {
      direction = "debit";
    }
    if (balance !== null) previousBalance = balance;

    const description = txn.text
      .slice(0, amountToken.index)
      .replace(MARKER, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!description) {
      skipped += 1;
      continue;
    }

    const refMatch = description.match(/\b(\d{9,18})\b/);
    rows.push({
      date: txn.date,
      description,
      amount: Math.abs(amount),
      direction,
      refNo: refMatch ? refMatch[1] : undefined,
      balance: balance ?? undefined,
    });
  }

  return { rows, skipped };
}
