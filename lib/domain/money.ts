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
