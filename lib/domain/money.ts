export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinorUnits(minor: number): number {
  return minor / 100;
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function formatMoney(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currency}${formatted}`;
}

export function splitEqually(amount: number, ways: number): number[] {
  const totalMinor = toMinorUnits(amount);
  const base = Math.floor(totalMinor / ways);
  const remainder = totalMinor - base * ways;
  return Array.from({ length: ways }, (_, i) =>
    fromMinorUnits(base + (i < remainder ? 1 : 0)),
  );
}

export function splitByPercentage(amount: number, percentages: number[]): number[] {
  const totalMinor = toMinorUnits(amount);
  const raw = percentages.map((pct) => Math.floor((totalMinor * pct) / 100));
  let assigned = raw.reduce((sum, value) => sum + value, 0);
  let index = 0;
  while (assigned < totalMinor && percentages.length > 0) {
    raw[index % raw.length] += 1;
    assigned += 1;
    index += 1;
  }
  return raw.map(fromMinorUnits);
}

export function normalizeShares(values: number[]): number[] {
  return values.map((value) => roundMoney(value));
}
