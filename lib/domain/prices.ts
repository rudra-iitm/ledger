import type { Account, AssetType } from "./types";

export function assetNeedsPriceId(assetType: AssetType): boolean {
  return (
    assetType === "mutual_fund" ||
    assetType === "sip" ||
    assetType === "etf" ||
    assetType === "stock" ||
    assetType === "crypto"
  );
}

export function priceIdHint(assetType: AssetType): string {
  switch (assetType) {
    case "mutual_fund":
    case "sip":
      return "AMFI scheme code (e.g. 120503)";
    case "etf":
    case "stock":
      return "Ticker symbol (e.g. RELIANCE.NS, AAPL)";
    case "crypto":
      return "CoinGecko id (e.g. bitcoin)";
    default:
      return "";
  }
}

export function accountPriceKey(account: Account): string | null {
  if (account.type !== "investment" || !account.assetType) return null;
  switch (account.assetType) {
    case "gold":
      return "metal:gold";
    case "silver":
      return "metal:silver";
    case "mutual_fund":
    case "sip":
      return account.priceId ? `mf:${account.priceId}` : null;
    case "etf":
    case "stock":
      return account.priceId ? `stock:${account.priceId}` : null;
    case "crypto":
      return account.priceId ? `crypto:${account.priceId}` : null;
    default:
      return null;
  }
}

export function buildPriceParams(accounts: Account[]): URLSearchParams | null {
  const buckets: Record<string, Set<string>> = {
    mf: new Set(),
    crypto: new Set(),
    metal: new Set(),
    stock: new Set(),
  };
  for (const account of accounts) {
    const key = accountPriceKey(account);
    if (!key) continue;
    const [source, id] = key.split(/:(.+)/);
    buckets[source]?.add(id);
  }
  const params = new URLSearchParams();
  for (const [source, ids] of Object.entries(buckets)) {
    if (ids.size > 0) params.set(source, [...ids].join(","));
  }
  return [...params.keys()].length > 0 ? params : null;
}

export interface PriceUpdate {
  id: string;
  currentPrice: number;
}

export function priceUpdates(
  accounts: Account[],
  prices: Record<string, number>,
): PriceUpdate[] {
  const updates: PriceUpdate[] = [];
  for (const account of accounts) {
    const key = accountPriceKey(account);
    if (!key) continue;
    const price = prices[key];
    if (Number.isFinite(price) && price > 0 && price !== account.currentPrice) {
      updates.push({ id: account.id, currentPrice: price });
    }
  }
  return updates;
}
