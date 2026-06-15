const OUNCE_GRAMS = 31.1034768;

export interface PriceRequest {
  mf: string[];
  crypto: string[];
  metal: string[];
  stock: string[];
  vs: string;
}

export function parsePriceQuery(url: URL): PriceRequest {
  const list = (key: string): string[] =>
    (url.searchParams.get(key) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  return {
    mf: list("mf"),
    crypto: list("crypto"),
    metal: list("metal"),
    stock: list("stock"),
    vs: (url.searchParams.get("vs") ?? "inr").toLowerCase(),
  };
}

export async function computePrices(
  req: PriceRequest,
): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  await Promise.all([
    addMutualFunds(req.mf, prices),
    addCrypto(req.crypto, req.vs, prices),
    addMetals(req.metal, prices),
    addStocks(req.stock, prices),
  ]);
  return prices;
}

async function addMutualFunds(
  codes: string[],
  out: Record<string, number>,
): Promise<void> {
  if (codes.length === 0) return;
  const wanted = new Set(codes);
  try {
    const response = await fetch("https://www.amfiindia.com/spages/NAVAll.txt", {
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
    if (!response.ok) return;
    const text = await response.text();
    for (const line of text.split("\n")) {
      if (!line.includes(";")) continue;
      const parts = line.split(";");
      const code = parts[0]?.trim();
      if (!code || !wanted.has(code)) continue;
      const nav = Number(parts[4]);
      if (Number.isFinite(nav) && nav > 0) out[`mf:${code}`] = nav;
    }
  } catch {
    /* best effort */
  }
}

async function addCrypto(
  ids: string[],
  vs: string,
  out: Record<string, number>,
): Promise<void> {
  if (ids.length === 0) return;
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
      ids.join(","),
    )}&vs_currencies=${encodeURIComponent(vs)}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: 600, cacheEverything: true },
    });
    if (!response.ok) return;
    const data = (await response.json()) as Record<
      string,
      Record<string, number>
    >;
    for (const id of ids) {
      const value = data[id]?.[vs];
      if (Number.isFinite(value) && value > 0) out[`crypto:${id}`] = value;
    }
  } catch {
    /* best effort */
  }
}

async function addMetals(
  metals: string[],
  out: Record<string, number>,
): Promise<void> {
  if (metals.length === 0) return;
  try {
    const response = await fetch(
      "https://data-asg.goldprice.org/dbXRates/INR",
      {
        headers: { Accept: "application/json" },
        cf: { cacheTtl: 1800, cacheEverything: true },
      },
    );
    if (!response.ok) return;
    const data = (await response.json()) as {
      items?: Array<{ xauPrice?: number; xagPrice?: number }>;
    };
    const item = data.items?.[0];
    if (!item) return;
    const perGram = (ounce?: number): number | undefined =>
      Number.isFinite(ounce) && (ounce ?? 0) > 0
        ? (ounce as number) / OUNCE_GRAMS
        : undefined;
    const gold = perGram(item.xauPrice);
    const silver = perGram(item.xagPrice);
    if (metals.includes("gold") && gold !== undefined) out["metal:gold"] = gold;
    if (metals.includes("silver") && silver !== undefined)
      out["metal:silver"] = silver;
  } catch {
    /* best effort */
  }
}

async function addStocks(
  symbols: string[],
  out: Record<string, number>,
): Promise<void> {
  if (symbols.length === 0) return;
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          symbol,
        )}`;
        const response = await fetch(url, {
          headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
          cf: { cacheTtl: 600, cacheEverything: true },
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          chart?: {
            result?: Array<{ meta?: { regularMarketPrice?: number } }>;
          };
        };
        const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (Number.isFinite(price) && (price ?? 0) > 0)
          out[`stock:${symbol}`] = price as number;
      } catch {
        /* best effort */
      }
    }),
  );
}
