import { describe, expect, it } from "vitest";
import { formatMoney, splitEqually } from "@/lib/domain/money";

describe("splitEqually", () => {
  it("splits evenly divisible amounts", () => {
    expect(splitEqually(100, 4)).toEqual([25, 25, 25, 25]);
  });

  it("distributes remainder paise to the first shares", () => {
    expect(splitEqually(100, 3)).toEqual([33.34, 33.33, 33.33]);
    const total = splitEqually(100, 3).reduce((sum, share) => sum + share, 0);
    expect(total).toBeCloseTo(100, 10);
  });

  it("handles fractional amounts", () => {
    expect(splitEqually(0.05, 2)).toEqual([0.03, 0.02]);
  });
});

describe("formatMoney", () => {
  it("formats whole amounts without decimals", () => {
    expect(formatMoney(1500, "₹")).toBe("₹1,500");
  });

  it("keeps decimals when fractional", () => {
    expect(formatMoney(99.5, "₹")).toBe("₹99.50");
  });
});
