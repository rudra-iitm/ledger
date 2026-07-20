import type { Account } from "../types";
import { parseStatementAmount, parseStatementDate, type StatementRow } from "./csv";

/**
 * Heuristic parsers for text lines extracted from PDF bank/card statements.
 *
 * Two strategies cover the layouts Indian banks actually ship:
 *
 * 1. Date-headed lines — each transaction line starts with a date and ends
 *    with amount(+balance) money tokens (HDFC/Axis-style running layouts).
 * 2. Numbered tables — rows anchored by a serial number + date(s) with
 *    debit/credit/balance columns where the empty column is a dash, and
 *    the description wrapped onto separate lines above/below the anchor
 *    (Bank of Baroda-style). Wrapped fragments are re-attached to their
 *    row by vertical proximity and joined without spaces so tokens split
 *    mid-word (UPI VPAs, references) are reconstructed.
 */

/** A visual line from the PDF with enough geometry to reattach wraps. */
export interface PdfLine {
  text: string;
  y: number;
  page: number;
}

export interface SavedStatementPassword {
  accountId: string;
  accountName: string;
  password: string;
}

/**
 * Statement passwords saved on any account, deduped by value with the
 * given account's password (if any) listed first.
 */
export function collectStatementPasswords(
  accounts: Account[],
  preferredAccountId?: string,
): SavedStatementPassword[] {
  const seen = new Set<string>();
  const ordered = [...accounts].sort((a, b) =>
    a.id === preferredAccountId ? -1 : b.id === preferredAccountId ? 1 : 0,
  );
  const result: SavedStatementPassword[] = [];
  for (const account of ordered) {
    const password = account.statementPassword?.trim();
    if (!password || seen.has(password)) continue;
    seen.add(password);
    result.push({ accountId: account.id, accountName: account.name, password });
  }
  return result;
}

const DATE_HEAD =
  /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3}[a-z]*\s+\d{2,4})\b[.,]?\s*(.*)$/;
const MONEY = /\d[\d,]*\.\d{2}/g;
const MARKER = /\b(cr|dr)\.?\b/i;
const NUMBERED_ANCHOR =
  /^(\d{1,4})\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(?:(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+)?(.*)$/;
const NOISE =
  /page \d+ of \d+|computer[- ]generated|statement is generated|account statement|sr\.? ?no|debit\s+credit\s+balance|cheque\s*number|^date date$|maintained in the bank/i;
const DEVANAGARI = /[ऀ-ॿ]/;

export interface PdfParseResult {
  rows: StatementRow[];
  skipped: number;
}

function toPdfLines(lines: string[] | PdfLine[]): PdfLine[] {
  return lines.map((line, index) =>
    typeof line === "string"
      ? { text: line, y: -index * 10, page: 1 }
      : line,
  );
}

function isNoise(text: string): boolean {
  return NOISE.test(text) || DEVANAGARI.test(text);
}

export function parseStatementLines(
  input: string[] | PdfLine[],
): PdfParseResult {
  const lines = toPdfLines(input).filter((line) => line.text.trim().length > 0);
  const anchorCount = lines.filter((line) =>
    NUMBERED_ANCHOR.test(line.text.trim()),
  ).length;
  return anchorCount >= 3
    ? parseNumberedTable(lines)
    : parseDateHeaded(lines.map((line) => line.text));
}

// ---------------------------------------------------------------------------
// Strategy 1: date-headed running layouts
// ---------------------------------------------------------------------------

interface RawTxn {
  date: string;
  text: string;
}

function parseDateHeaded(lines: string[]): PdfParseResult {
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

// ---------------------------------------------------------------------------
// Strategy 2: numbered debit/credit/balance tables (BoB-style)
// ---------------------------------------------------------------------------

interface Anchor {
  line: PdfLine;
  date: string;
  rest: string;
  /** Wrapped description lines above the anchor (in reading order). */
  tops: string[];
  /** Wrapped description lines below the anchor (in reading order). */
  bottoms: string[];
}

interface ColumnAmounts {
  amount: number;
  direction: "debit" | "credit" | null;
  balance: number | null;
  refNo?: string;
  inlineDescription: string;
}

/**
 * Parses the tail of an anchor row: optional description words, an optional
 * cheque/reference number, then [debit|-] [credit|-] balance columns (the
 * dash marks the empty column; some banks omit it entirely).
 */
function parseColumns(rest: string): ColumnAmounts | null {
  const tokens = rest.split(/\s+/).filter(Boolean);
  const isMoney = (token: string) => /^\d[\d,]*\.\d{2}$/.test(token);
  const isDash = (token: string) => /^[-–—]$/.test(token);

  // Walk backwards collecting the money/dash column window.
  const tail: string[] = [];
  let cursor = tokens.length - 1;
  while (cursor >= 0 && tail.length < 3) {
    const token = tokens[cursor];
    if (isMoney(token) || isDash(token)) {
      tail.unshift(token);
      cursor -= 1;
    } else {
      break;
    }
  }
  if (tail.length === 0 || !isMoney(tail[tail.length - 1])) return null;

  const balance = parseStatementAmount(tail[tail.length - 1]);
  let amount: number | null = null;
  let direction: "debit" | "credit" | null = null;

  if (tail.length === 3) {
    const [debitSlot, creditSlot] = tail;
    if (isMoney(debitSlot) && isDash(creditSlot)) {
      amount = parseStatementAmount(debitSlot);
      direction = "debit";
    } else if (isDash(debitSlot) && isMoney(creditSlot)) {
      amount = parseStatementAmount(creditSlot);
      direction = "credit";
    } else if (isDash(debitSlot) && isDash(creditSlot)) {
      // Opening/closing balance style row: no movement.
      amount = null;
    } else if (isMoney(debitSlot) && isMoney(creditSlot)) {
      // Ambiguous double-money row — treat first as amount, resolve
      // direction by balance delta later.
      amount = parseStatementAmount(debitSlot);
    }
  } else if (tail.length === 2) {
    const [first] = tail;
    if (isMoney(first)) amount = parseStatementAmount(first);
  }

  const remainder = tokens.slice(0, cursor + 1);
  let refNo: string | undefined;
  if (remainder.length > 0 && /^\d{5,18}$/.test(remainder[remainder.length - 1])) {
    refNo = remainder.pop();
  }

  return {
    amount: amount ?? 0,
    direction,
    balance,
    refNo,
    inlineDescription: remainder.join(" "),
  };
}

function parseNumberedTable(lines: PdfLine[]): PdfParseResult {
  // Walk in reading order, tagging each line as an anchor or an orphan
  // remembered together with its surrounding anchors.
  const anchors: Anchor[] = [];
  interface Orphan {
    line: PdfLine;
    prev: Anchor | null;
    groupStart: boolean;
  }
  const orphans: Orphan[] = [];
  let lastAnchor: Anchor | null = null;
  let lastWasOrphan = false;

  for (const line of lines) {
    const text = line.text.replace(/\s+/g, " ").trim();
    const match = text.match(NUMBERED_ANCHOR);
    if (match) {
      const date = parseStatementDate(match[2]);
      if (date) {
        const anchor: Anchor = {
          line,
          date,
          rest: match[4] ?? "",
          tops: [],
          bottoms: [],
        };
        anchors.push(anchor);
        lastAnchor = anchor;
        lastWasOrphan = false;
        continue;
      }
    }
    if (!isNoise(text)) {
      orphans.push({
        line: { ...line, text },
        prev: lastAnchor?.line.page === line.page ? lastAnchor : null,
        groupStart: !lastWasOrphan,
      });
      lastWasOrphan = true;
    } else {
      lastWasOrphan = false;
    }
  }

  // Typical vertical distance between consecutive anchors — the cap that
  // keeps page chrome from being adopted as a description.
  const gaps: number[] = [];
  for (let i = 1; i < anchors.length; i += 1) {
    if (anchors[i].line.page === anchors[i - 1].line.page) {
      gaps.push(Math.abs(anchors[i - 1].line.y - anchors[i].line.y));
    }
  }
  const medianGap = gaps.length
    ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
    : 24;
  const maxDistance = medianGap * 0.8;

  // Descriptions render from the TOP of a row's band: the first line of a
  // wrapped cell sits above its anchor, overflow continues below. So within
  // a group of orphan lines between two anchors, only the group's first
  // line can be the upper row's overflow — and only when the group has
  // more than one line. A lone line between anchors starts the next row.
  for (let i = 0; i < orphans.length; i += 1) {
    const orphan = orphans[i];
    const next = anchors.find(
      (anchor) =>
        anchor.line.page === orphan.line.page &&
        anchor.line.y < orphan.line.y,
    );
    const groupSize = (() => {
      let size = 1;
      for (let j = i + 1; j < orphans.length && !orphans[j].groupStart; j += 1) {
        size += 1;
      }
      if (!orphan.groupStart) return 0; // counted by its group head
      return size;
    })();

    const attach = (anchor: Anchor | null, slot: "tops" | "bottoms") => {
      if (!anchor) return;
      if (Math.abs(anchor.line.y - orphan.line.y) > maxDistance) return;
      anchor[slot].push(orphan.line.text);
    };

    if (orphan.groupStart && groupSize >= 2 && orphan.prev && next) {
      attach(orphan.prev, "bottoms"); // overflow of the row above
    } else if (next) {
      attach(next, "tops"); // first line(s) of the row below
    } else {
      attach(orphan.prev, "bottoms"); // trailing overflow after the last row
    }
  }

  const rows: StatementRow[] = [];
  let previousBalance: number | null = null;
  let skipped = 0;

  for (const anchor of anchors) {
    const columns = parseColumns(anchor.rest);
    if (!columns) {
      skipped += 1;
      continue;
    }

    // Wrapped cells split mid-token — join fragments without spaces so
    // VPAs and references reassemble ("...2003@" + "oks" → "...2003@oks").
    const description = [
      ...anchor.tops,
      columns.inlineDescription,
      ...anchor.bottoms,
    ]
      .join("")
      .replace(/\s+/g, " ")
      .trim();

    const isBalanceRow =
      /opening balance|closing balance|balance forward|b\/f|c\/f/i.test(
        `${columns.inlineDescription} ${description}`,
      );
    if (isBalanceRow || columns.amount === 0) {
      if (columns.balance !== null) previousBalance = columns.balance;
      continue;
    }

    let direction = columns.direction;
    if (!direction) {
      direction =
        columns.balance !== null && previousBalance !== null
          ? columns.balance < previousBalance
            ? "debit"
            : "credit"
          : "debit";
    }
    if (columns.balance !== null) previousBalance = columns.balance;

    if (!description) {
      skipped += 1;
      continue;
    }

    const refMatch = description.match(/\b(\d{9,18})\b/);
    rows.push({
      date: anchor.date,
      description,
      amount: Math.abs(columns.amount),
      direction,
      refNo: columns.refNo ?? (refMatch ? refMatch[1] : undefined),
      balance: columns.balance ?? undefined,
    });
  }

  return { rows, skipped };
}
