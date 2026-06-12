export type InstitutionType =
  | "bank"
  | "credit_card"
  | "wallet"
  | "brokerage"
  | "network"
  | "other";

export interface Institution {
  id: string;
  name: string;
  aliases: string[];
  type: InstitutionType;
  accentColor: string;
  domain?: string;
}

export const INSTITUTION_REGISTRY: Institution[] = [
  { id: "hdfc", name: "HDFC Bank", aliases: ["hdfc", "hdfc bank", "hdfcbank"], type: "bank", accentColor: "#004B8D", domain: "hdfcbank.com" },
  { id: "icici", name: "ICICI Bank", aliases: ["icici", "icici bank", "icicibank"], type: "bank", accentColor: "#F18221", domain: "icicibank.com" },
  { id: "sbi", name: "SBI", aliases: ["sbi", "state bank of india"], type: "bank", accentColor: "#0072B1", domain: "onlinesbi.sbi" },
  { id: "axis", name: "Axis Bank", aliases: ["axis", "axis bank", "axisbank"], type: "bank", accentColor: "#861F41", domain: "axisbank.com" },
  { id: "kotak", name: "Kotak Mahindra Bank", aliases: ["kotak", "kotak mahindra", "kotak bank"], type: "bank", accentColor: "#ED1C24", domain: "kotak.com" },
  { id: "bob", name: "Bank of Baroda", aliases: ["bob", "bank of baroda", "baroda"], type: "bank", accentColor: "#F47920", domain: "bankofbaroda.in" },
  { id: "pnb", name: "Punjab National Bank", aliases: ["pnb", "punjab national bank"], type: "bank", accentColor: "#F7CA18", domain: "pnbindia.in" },
  { id: "canara", name: "Canara Bank", aliases: ["canara", "canara bank"], type: "bank", accentColor: "#00AEEF", domain: "canarabank.com" },
  { id: "indusind", name: "IndusInd Bank", aliases: ["indusind", "indusind bank"], type: "bank", accentColor: "#741D2D", domain: "indusind.com" },
  { id: "union", name: "Union Bank", aliases: ["union bank", "union bank of india", "ubi"], type: "bank", accentColor: "#D12127", domain: "unionbankofindia.co.in" },
  { id: "indianbank", name: "Indian Bank", aliases: ["indian bank"], type: "bank", accentColor: "#004B8D", domain: "indianbank.in" },
  { id: "iob", name: "Indian Overseas Bank", aliases: ["iob", "indian overseas bank"], type: "bank", accentColor: "#005A9C", domain: "iob.in" },
  { id: "boi", name: "Bank of India", aliases: ["boi", "bank of india"], type: "bank", accentColor: "#F37021", domain: "bankofindia.co.in" },
  { id: "cbi", name: "Central Bank of India", aliases: ["central bank of india", "central bank"], type: "bank", accentColor: "#00529B", domain: "centralbankofindia.co.in" },
  { id: "uco", name: "UCO Bank", aliases: ["uco", "uco bank"], type: "bank", accentColor: "#F37B21", domain: "ucobank.com" },
  { id: "bom", name: "Bank of Maharashtra", aliases: ["bom", "bank of maharashtra", "mahabank"], type: "bank", accentColor: "#00508F", domain: "bankofmaharashtra.in" },
  { id: "idbi", name: "IDBI Bank", aliases: ["idbi", "idbi bank"], type: "bank", accentColor: "#005A50", domain: "idbibank.in" },
  { id: "bandhan", name: "Bandhan Bank", aliases: ["bandhan", "bandhan bank"], type: "bank", accentColor: "#F05A22", domain: "bandhanbank.com" },
  { id: "rbl", name: "RBL Bank", aliases: ["rbl", "rbl bank", "ratnakar"], type: "bank", accentColor: "#003366", domain: "rblbank.com" },
  { id: "idfc", name: "IDFC FIRST Bank", aliases: ["idfc", "idfc first", "idfc bank"], type: "bank", accentColor: "#802A24", domain: "idfcfirstbank.com" },
  { id: "yesbank", name: "Yes Bank", aliases: ["yes bank", "yesbank"], type: "bank", accentColor: "#0055A5", domain: "yesbank.in" },
  { id: "federal", name: "Federal Bank", aliases: ["federal bank", "federal"], type: "bank", accentColor: "#2F509E", domain: "federalbank.co.in" },
  { id: "au", name: "AU Small Finance Bank", aliases: ["au bank", "au small finance"], type: "bank", accentColor: "#0A4E8E", domain: "aubank.in" },


  { id: "hsbc", name: "HSBC", aliases: ["hsbc", "hsbc bank"], type: "bank", accentColor: "#DB0011", domain: "hsbc.com" },
  { id: "citi", name: "Citi", aliases: ["citi", "citibank", "citi bank"], type: "bank", accentColor: "#003B70", domain: "citi.com" },
  { id: "sc", name: "Standard Chartered", aliases: ["sc", "standard chartered"], type: "bank", accentColor: "#00994A", domain: "sc.com" },
  { id: "chase", name: "Chase", aliases: ["chase", "jpmorgan chase"], type: "bank", accentColor: "#117ACA", domain: "chase.com" },
  { id: "bofa", name: "Bank of America", aliases: ["bofa", "bank of america"], type: "bank", accentColor: "#E31837", domain: "bankofamerica.com" },
  { id: "barclays", name: "Barclays", aliases: ["barclays", "barclays bank"], type: "bank", accentColor: "#00AEEF", domain: "barclays.com" },
  { id: "revolut", name: "Revolut", aliases: ["revolut"], type: "bank", accentColor: "#191C1F", domain: "revolut.com" },
  { id: "wise", name: "Wise", aliases: ["wise", "transferwise"], type: "bank", accentColor: "#9FE870", domain: "wise.com" },

  { id: "visa", name: "Visa", aliases: ["visa"], type: "network", accentColor: "#1A1F71", domain: "visa.com" },
  { id: "mastercard", name: "Mastercard", aliases: ["mastercard", "master card"], type: "network", accentColor: "#FF5F00", domain: "mastercard.us" },
  { id: "rupay", name: "RuPay", aliases: ["rupay"], type: "network", accentColor: "#F16E22", domain: "rupay.co.in" },
  { id: "amex", name: "American Express", aliases: ["amex", "american express"], type: "network", accentColor: "#002663", domain: "americanexpress.com" },
  { id: "diners", name: "Diners Club", aliases: ["diners club", "diners"], type: "network", accentColor: "#004B8D", domain: "dinersclub.com" },

  { id: "gpay", name: "Google Pay", aliases: ["gpay", "google pay"], type: "wallet", accentColor: "#4285F4", domain: "pay.google.com" },
  { id: "phonepe", name: "PhonePe", aliases: ["phonepe", "phone pe"], type: "wallet", accentColor: "#5F259F", domain: "phonepe.com" },
  { id: "paytm", name: "Paytm", aliases: ["paytm"], type: "wallet", accentColor: "#00B9F1", domain: "paytm.com" },
  { id: "bhim", name: "BHIM", aliases: ["bhim", "bhim upi"], type: "wallet", accentColor: "#F47B20", domain: "bhimupi.org.in" },
  { id: "cred", name: "CRED", aliases: ["cred", "cred pay"], type: "wallet", accentColor: "#000000", domain: "cred.club" },
  { id: "amazonpay", name: "Amazon Pay", aliases: ["amazon pay", "amazonpay"], type: "wallet", accentColor: "#FF9900", domain: "amazon.in" },
  { id: "jupiter", name: "Jupiter", aliases: ["jupiter", "jupiter money"], type: "wallet", accentColor: "#F7614B", domain: "jupiter.money" },
  { id: "fi", name: "Fi Money", aliases: ["fi", "fi money"], type: "wallet", accentColor: "#008169", domain: "fi.money" },
  { id: "slice", name: "Slice", aliases: ["slice", "sliceit", "slice card"], type: "credit_card", accentColor: "#7A4CF8", domain: "sliceit.com" },
  { id: "onecard", name: "OneCard", aliases: ["onecard", "one card"], type: "credit_card", accentColor: "#242424", domain: "getonecard.app" },
  { id: "niyo", name: "Niyo", aliases: ["niyo", "niyo global"], type: "wallet", accentColor: "#0051B2", domain: "goniyo.com" },
  { id: "tataneu", name: "Tata Neu", aliases: ["tata neu", "tataneu"], type: "wallet", accentColor: "#2B1143", domain: "tatadigital.com" },

  { id: "zerodha", name: "Zerodha", aliases: ["zerodha", "kite"], type: "brokerage", accentColor: "#387ED1", domain: "zerodha.com" },
  { id: "groww", name: "Groww", aliases: ["groww"], type: "brokerage", accentColor: "#00D09C", domain: "groww.in" },
  { id: "upstox", name: "Upstox", aliases: ["upstox"], type: "brokerage", accentColor: "#5B248D", domain: "upstox.com" },
  { id: "angelone", name: "Angel One", aliases: ["angel one", "angel broking"], type: "brokerage", accentColor: "#FF6600", domain: "angelone.in" },
  { id: "indmoney", name: "INDmoney", aliases: ["indmoney", "ind money"], type: "brokerage", accentColor: "#1F75FE", domain: "indmoney.com" },
  { id: "etmoney", name: "ET Money", aliases: ["et money", "etmoney"], type: "brokerage", accentColor: "#00B9F1", domain: "etmoney.com" },
  { id: "paytmmoney", name: "Paytm Money", aliases: ["paytm money", "paytmmoney"], type: "brokerage", accentColor: "#00B9F1", domain: "paytmmoney.com" },
  { id: "dhan", name: "Dhan", aliases: ["dhan", "dhan app"], type: "brokerage", accentColor: "#1A4CC1", domain: "dhan.co" },
  { id: "fivepaisa", name: "5paisa", aliases: ["5paisa", "5 paisa"], type: "brokerage", accentColor: "#F36D21", domain: "5paisa.com" },
];

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveInstitution(text: string): Institution | null {
  if (!text) return null;
  const normalized = text.toLowerCase();
  const cleaned = normalize(text);

  for (const inst of INSTITUTION_REGISTRY) {
    for (const alias of inst.aliases) {
      if (cleaned.includes(normalize(alias))) return inst;
    }
  }

  for (const inst of INSTITUTION_REGISTRY) {
    const boundaryRegex = new RegExp(`\\b${inst.id}\\b`, "i");
    if (boundaryRegex.test(normalized)) return inst;
  }

  return null;
}
