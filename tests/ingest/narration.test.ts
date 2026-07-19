import { describe, expect, it } from "vitest";
import { decodeNarration } from "@/lib/domain/ingest/narration";

describe("decodeNarration", () => {
  it("decodes UPI narrations with VPA and reference", () => {
    const decoded = decodeNarration("UPI-SWIGGY LIMITED-swiggy@icici-412345678901-Food order");
    expect(decoded.channel).toBe("upi");
    expect(decoded.vpa).toBe("swiggy@icici");
    expect(decoded.refNo).toBe("412345678901");
    expect(decoded.counterparty?.toLowerCase()).toContain("swiggy");
  });

  it("decodes NEFT/IMPS with counterparty name", () => {
    const neft = decodeNarration("NEFT-N123456789012345-RAMESH KUMAR-SALARY ADVANCE");
    expect(neft.channel).toBe("neft");
    const imps = decodeNarration("IMPS/512345678901/PRIYA S/OKICICI");
    expect(imps.channel).toBe("imps");
    expect(imps.counterparty?.toLowerCase()).toContain("priya");
  });

  it("recognizes NACH mandates, ATM, POS, cheque", () => {
    expect(decodeNarration("ACH D- INDIANCLEARINGCORP-SIP").channel).toBe("nach");
    expect(decodeNarration("ATW-512345-HDFC BANK ATM-MUMBAI").channel).toBe("atm");
    expect(decodeNarration("POS 412345XXXXXX7890 AMAZON PAY").channel).toBe("pos");
    expect(decodeNarration("CHQ PAID 000123").channel).toBe("cheque");
  });

  it("recognizes interest, salary, refunds, charges", () => {
    expect(decodeNarration("CREDIT INTEREST CAPITALISED").channel).toBe("interest");
    expect(decodeNarration("SALARY JUL ACME CORP").channel).toBe("salary");
    expect(decodeNarration("REFUND-AMAZON ORDER 403-1234").channel).toBe("refund");
    expect(decodeNarration("SMS CHG JUN + GST").channel).toBe("charge");
  });

  it("falls back to other with a cleaned counterparty", () => {
    const decoded = decodeNarration("BLINKIT COMMERCE PVT LTD 991234");
    expect(decoded.channel).toBe("other");
    expect(decoded.counterparty?.toLowerCase()).toContain("blinkit");
  });
});
