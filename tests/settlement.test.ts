import { describe, expect, it } from "vitest";
import {
  computeBalances,
  optimizeSettlements,
  settleGroup,
} from "@/lib/domain/settlement";
import type { Group } from "@/lib/domain/types";

function makeGroup(
  members: string[],
  expenses: Array<{
    amount: number;
    paidBy: string;
    splitAmong: string[];
  }>,
): Group {
  return {
    id: "g1",
    name: "Trip",
    createdAt: "2026-01-01T00:00:00.000Z",
    members: members.map((id) => ({ id, name: id })),
    expenses: expenses.map((expense, index) => ({
      id: `e${index}`,
      description: `expense ${index}`,
      date: "2026-01-02",
      createdAt: "2026-01-02T00:00:00.000Z",
      ...expense,
    })),
  };
}

describe("computeBalances", () => {
  it("nets payers against equal splits", () => {
    const group = makeGroup(["a", "b"], [
      { amount: 100, paidBy: "a", splitAmong: ["a", "b"] },
    ]);
    const balances = computeBalances(group);
    expect(balances.get("a")).toBe(50);
    expect(balances.get("b")).toBe(-50);
  });

  it("distributes indivisible paise without losing money", () => {
    const group = makeGroup(["a", "b", "c"], [
      { amount: 100, paidBy: "a", splitAmong: ["a", "b", "c"] },
    ]);
    const balances = computeBalances(group);
    const total = Array.from(balances.values()).reduce((s, v) => s + v, 0);
    expect(Math.abs(total)).toBeLessThan(0.005);
  });

  it("supports splits that exclude the payer", () => {
    const group = makeGroup(["a", "b"], [
      { amount: 80, paidBy: "a", splitAmong: ["b"] },
    ]);
    const balances = computeBalances(group);
    expect(balances.get("a")).toBe(80);
    expect(balances.get("b")).toBe(-80);
  });
});

describe("optimizeSettlements", () => {
  it("returns nothing when settled", () => {
    expect(optimizeSettlements(new Map([["a", 0], ["b", 0]]))).toEqual([]);
  });

  it("settles a simple debt with one transaction", () => {
    const settlements = optimizeSettlements(
      new Map([["a", 50], ["b", -50]]),
    );
    expect(settlements).toEqual([{ from: "b", to: "a", amount: 50 }]);
  });

  it("prefers exact matches to minimize transactions", () => {
    const settlements = optimizeSettlements(
      new Map([
        ["a", 100],
        ["b", 30],
        ["c", -100],
        ["d", -30],
      ]),
    );
    expect(settlements).toHaveLength(2);
    expect(settlements).toContainEqual({ from: "c", to: "a", amount: 100 });
    expect(settlements).toContainEqual({ from: "d", to: "b", amount: 30 });
  });

  it("never needs more than n-1 transactions", () => {
    const balances = new Map([
      ["a", 90],
      ["b", 10],
      ["c", -40],
      ["d", -35],
      ["e", -25],
    ]);
    const settlements = optimizeSettlements(balances);
    expect(settlements.length).toBeLessThanOrEqual(4);

    const net = new Map<string, number>();
    for (const { from, to, amount } of settlements) {
      net.set(from, (net.get(from) ?? 0) + amount);
      net.set(to, (net.get(to) ?? 0) - amount);
    }
    expect(net.get("a")).toBeCloseTo(-90);
    expect(net.get("c")).toBeCloseTo(40);
  });

  it("settles an end-to-end group correctly", () => {
    const group = makeGroup(["a", "b", "c"], [
      { amount: 300, paidBy: "a", splitAmong: ["a", "b", "c"] },
      { amount: 150, paidBy: "b", splitAmong: ["a", "b", "c"] },
    ]);
    const settlements = settleGroup(group);
    expect(settlements).toEqual([{ from: "c", to: "a", amount: 150 }]);
  });
});
