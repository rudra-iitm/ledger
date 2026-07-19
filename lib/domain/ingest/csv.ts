import type { CsvMapping } from "../types";

/** One normalized line of a bank statement, ready for the import pipeline. */
export interface StatementRow {
  date: string;
  description: string;
  amount: number;
  direction: "debit" | "credit";
  refNo?: string;
  balance?: number;
}

/** RFC-4180-ish CSV parser: quoted fields, escaped quotes, CR/LF endings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function expandYear(raw: string): number {
  const year = Number(raw);
  return raw.length === 2 ? 2000 + year : year;
}

/**
 * Parses common Indian bank statement dates to YYYY-MM-DD.
 * Numeric day-first (DD/MM/YYYY, DD-MM-YY) per Indian convention.
 */
export function parseStatementDate(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const numeric = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = expandYear(numeric[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  const named = raw.match(/^(\d{1,2})[\s/-]([A-Za-z]{3})[a-z]*[\s/,-]+(\d{2}|\d{4})$/);
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    if (!month) return null;
    const day = Number(named[1]);
    if (day < 1 || day > 31) return null;
    return `${expandYear(named[3])}-${pad(month)}-${pad(day)}`;
  }
  return null;
}

/** Parses "1,23,456.78", "₹500", "500 CR", "(120)" → signed number, or null. */
export function parseStatementAmount(value: string): number | null {
  let raw = value.trim();
  if (!raw) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(raw)) {
    sign = -1;
    raw = raw.slice(1, -1);
  }
  const marker = raw.match(/\b(cr|dr)\.?$/i);
  if (marker) {
    if (marker[1].toLowerCase() === "dr") sign = -1;
    raw = raw.slice(0, marker.index).trim();
  }
  raw = raw.replace(/[₹$\s,]/g, "");
  if (raw.startsWith("-")) {
    sign = -1;
    raw = raw.slice(1);
  }
  if (!/^\d*\.?\d+$/.test(raw)) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) ? sign * amount : null;
}

const HEADER_HINTS: Record<keyof Omit<CsvMapping, "hasHeader">, string[]> = {
  dateCol: ["date", "txndate", "transactiondate", "valuedate", "postdate"],
  descCol: ["narration", "description", "particulars", "remarks", "details", "transactiondetails"],
  debitCol: ["withdrawal", "withdrawalamt", "debit", "debitamount", "dr", "withdrawals"],
  creditCol: ["deposit", "depositamt", "credit", "creditamount", "cr", "deposits"],
  amountCol: ["amount", "transactionamount", "amt"],
  refCol: ["ref", "refno", "referenceno", "reference", "chqno", "chequeno", "chqrefno", "utr", "utrno"],
  balanceCol: ["balance", "closingbalance", "runningbalance", "availablebalance"],
};

function normalizeHeader(cell: string): string {
  return cell.toLowerCase().replace(/[^a-z]/g, "");
}

/** Guesses a column mapping from a header row; null when no date+description found. */
export function guessMapping(headerRow: string[]): CsvMapping | null {
  const found: Partial<Record<keyof Omit<CsvMapping, "hasHeader">, number>> = {};
  headerRow.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    if (!normalized) return;
    for (const [role, hints] of Object.entries(HEADER_HINTS)) {
      const key = role as keyof Omit<CsvMapping, "hasHeader">;
      if (found[key] !== undefined) continue;
      if (hints.some((hint) => normalized === hint || normalized.startsWith(hint))) {
        found[key] = index;
        return;
      }
    }
  });
  if (found.dateCol === undefined || found.descCol === undefined) return null;
  if (found.debitCol === undefined && found.creditCol === undefined && found.amountCol === undefined) {
    return null;
  }
  return {
    dateCol: found.dateCol,
    descCol: found.descCol,
    debitCol: found.debitCol,
    creditCol: found.creditCol,
    amountCol: found.amountCol,
    refCol: found.refCol,
    balanceCol: found.balanceCol,
    hasHeader: true,
  };
}

export interface ParsedStatement {
  rows: StatementRow[];
  skipped: number;
}

/** Applies a mapping to raw CSV text, producing normalized statement rows. */
export function parseStatementCsv(text: string, mapping: CsvMapping): ParsedStatement {
  const table = parseCsv(text);
  const body = mapping.hasHeader ? table.slice(1) : table;
  const rows: StatementRow[] = [];
  let skipped = 0;
  for (const cells of body) {
    const date = parseStatementDate(cells[mapping.dateCol] ?? "");
    const description = (cells[mapping.descCol] ?? "").trim();
    if (!date || !description) {
      skipped += 1;
      continue;
    }
    let amount: number | null = null;
    let direction: "debit" | "credit" | null = null;
    if (mapping.debitCol !== undefined || mapping.creditCol !== undefined) {
      const debit =
        mapping.debitCol !== undefined
          ? parseStatementAmount(cells[mapping.debitCol] ?? "")
          : null;
      const credit =
        mapping.creditCol !== undefined
          ? parseStatementAmount(cells[mapping.creditCol] ?? "")
          : null;
      if (debit && debit !== 0) {
        amount = Math.abs(debit);
        direction = "debit";
      } else if (credit && credit !== 0) {
        amount = Math.abs(credit);
        direction = "credit";
      }
    } else if (mapping.amountCol !== undefined) {
      const signed = parseStatementAmount(cells[mapping.amountCol] ?? "");
      if (signed && signed !== 0) {
        amount = Math.abs(signed);
        direction = signed < 0 ? "debit" : "credit";
      }
    }
    if (!amount || !direction) {
      skipped += 1;
      continue;
    }
    const refRaw =
      mapping.refCol !== undefined ? (cells[mapping.refCol] ?? "").trim() : "";
    const balance =
      mapping.balanceCol !== undefined
        ? parseStatementAmount(cells[mapping.balanceCol] ?? "")
        : null;
    rows.push({
      date,
      description,
      amount: Math.round(amount * 100) / 100,
      direction,
      refNo: refRaw && refRaw !== "-" ? refRaw : undefined,
      balance: balance ?? undefined,
    });
  }
  return { rows, skipped };
}

/** Stable FNV-1a content hash making statement-line imports idempotent. */
export function computeLineHash(accountId: string, row: StatementRow): string {
  const normalized = row.description.toLowerCase().replace(/\s+/g, " ").trim();
  const input = [
    accountId,
    row.date,
    row.direction,
    row.amount.toFixed(2),
    normalized,
    row.refNo ?? "",
  ].join("|");
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code + i;
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}
