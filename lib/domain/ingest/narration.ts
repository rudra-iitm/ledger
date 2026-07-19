/**
 * Decoder for Indian bank statement narrations.
 * Turns strings like "UPI-SWIGGY-swiggy@icici-412345678901-Food order"
 * into a channel, counterparty, UPI VPA, and reference number.
 */

export type NarrationChannel =
  | "upi"
  | "neft"
  | "imps"
  | "rtgs"
  | "nach"
  | "atm"
  | "pos"
  | "card"
  | "cheque"
  | "interest"
  | "salary"
  | "refund"
  | "charge"
  | "other";

export interface DecodedNarration {
  channel: NarrationChannel;
  counterparty?: string;
  vpa?: string;
  refNo?: string;
}

const VPA_PATTERN = /[a-z0-9._]+@[a-z][a-z0-9]+/i;

function cleanCounterparty(raw: string): string | undefined {
  const cleaned = raw
    .replace(VPA_PATTERN, " ")
    .replace(/\b\d{6,}\b/g, " ")
    .replace(/[/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || /^\d+$/.test(cleaned)) return undefined;
  return cleaned;
}

function findRef(raw: string): string | undefined {
  const match = raw.match(/\b(\d{9,18})\b/);
  return match ? match[1] : undefined;
}

export function decodeNarration(rawInput: string): DecodedNarration {
  const raw = rawInput.trim();
  const upper = raw.toUpperCase();
  const vpa = raw.match(VPA_PATTERN)?.[0]?.toLowerCase();
  const refNo = findRef(raw);

  if (/^UPI[/\s-]|[/\s-]UPI[/\s-]|^UPI:/.test(upper) || (vpa && /UPI/.test(upper))) {
    const body = raw.replace(/^UPI[/\s-]*/i, "");
    return {
      channel: "upi",
      counterparty: cleanCounterparty(body.split(/[/-]/)[0] ?? body),
      vpa,
      refNo,
    };
  }
  if (/^(NEFT|IMPS|RTGS)\b|[\s/-](NEFT|IMPS|RTGS)[\s/-]/.test(upper)) {
    const channel = upper.includes("IMPS")
      ? "imps"
      : upper.includes("RTGS")
        ? "rtgs"
        : "neft";
    const body = raw.replace(/^(NEFT|IMPS|RTGS)[/\s-]*/i, "");
    const segments = body.split(/[/-]/).map((part) => part.trim());
    const nameSegment = segments.find(
      (part) => part && !/^\d+$/.test(part) && !/^[A-Z0-9]{10,}$/.test(part),
    );
    return {
      channel,
      counterparty: cleanCounterparty(nameSegment ?? body),
      vpa,
      refNo,
    };
  }
  if (/\b(NACH|ACH|ECS|E-MANDATE|AUTOPAY|SI-)\b|^ACH[/\s-]|^NACH/.test(upper)) {
    return { channel: "nach", counterparty: cleanCounterparty(raw.replace(/^(NACH|ACH|ECS)[/\s-]*/i, "")), refNo };
  }
  if (/\b(ATW|ATM|NWD|CSH WDL|CASH WDL|CWDR)\b/.test(upper)) {
    return { channel: "atm", refNo };
  }
  if (/^POS\b|[\s/](POS)[\s/]|\bPOS PUR/.test(upper)) {
    return {
      channel: "pos",
      counterparty: cleanCounterparty(raw.replace(/^POS[\s/]*/i, "").replace(/\b\d{4}X+\d+\b/gi, " ")),
      refNo,
    };
  }
  if (/\b(INT\.?\s?PD|CREDIT INTEREST|SB INT|INTEREST (PAID|CREDIT))/.test(upper)) {
    return { channel: "interest" };
  }
  if (/\bSALARY\b|^SAL\b|\bSAL CREDIT|\bPAYROLL\b/.test(upper)) {
    return { channel: "salary", counterparty: cleanCounterparty(raw.replace(/salary|payroll/gi, " ")), refNo };
  }
  if (/\b(REVERSAL|REFUND|REV[\s/-])/.test(upper)) {
    return { channel: "refund", counterparty: cleanCounterparty(raw.replace(/reversal|refund/gi, " ")), refNo };
  }
  if (/\b(CHRG|CHARGES?|SMS CHG|AMC|ANNUAL FEE|GST)\b/.test(upper)) {
    return { channel: "charge", counterparty: cleanCounterparty(raw) };
  }
  if (/\b(CHQ|CHEQUE|CLG)\b/.test(upper)) {
    return { channel: "cheque", counterparty: cleanCounterparty(raw.replace(/chq|cheque|clg/gi, " ")), refNo };
  }
  return { channel: "other", counterparty: cleanCounterparty(raw), vpa, refNo };
}

/** Human title for a decoded row when no better description exists. */
export function fallbackDescription(decoded: DecodedNarration, raw: string): string {
  if (decoded.counterparty) return decoded.counterparty;
  switch (decoded.channel) {
    case "atm":
      return "ATM withdrawal";
    case "interest":
      return "Bank interest";
    case "charge":
      return "Bank charges";
    case "salary":
      return "Salary";
    default: {
      const trimmed = raw.replace(/\s+/g, " ").trim();
      return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed || "Imported transaction";
    }
  }
}
