import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "@/lib/domain/quick-add";

describe("parseQuickAdd", () => {
  it("parses description followed by amount", () => {
    expect(parseQuickAdd("lunch 450")).toEqual({
      description: "lunch",
      amount: 450,
      category: "Food",
    });
  });

  it("parses travel and bill keywords", () => {
    expect(parseQuickAdd("uber 280")).toMatchObject({
      description: "uber",
      amount: 280,
      category: "Travel",
    });
    expect(parseQuickAdd("netflix 199")).toMatchObject({
      category: "Bills",
    });
  });

  it("parses amount-first input", () => {
    expect(parseQuickAdd("450 lunch with team")).toEqual({
      description: "lunch with team",
      amount: 450,
      category: "Food",
    });
  });

  it("handles currency symbols, commas, and decimals", () => {
    expect(parseQuickAdd("groceries ₹1,250.50")).toEqual({
      description: "groceries",
      amount: 1250.5,
      category: "Food",
    });
    expect(parseQuickAdd("rent rs 15000")).toMatchObject({ amount: 15000 });
  });

  it("supports explicit category tags", () => {
    expect(parseQuickAdd("birthday gift 900 #shopping")).toEqual({
      description: "birthday gift",
      amount: 900,
      category: "Shopping",
    });
  });

  it("falls back to Other for unknown descriptions", () => {
    expect(parseQuickAdd("misc thing 100")).toMatchObject({
      category: "Other",
    });
  });

  it("rejects unparseable input", () => {
    expect(parseQuickAdd("")).toBeNull();
    expect(parseQuickAdd("lunch")).toBeNull();
    expect(parseQuickAdd("450")).toBeNull();
    expect(parseQuickAdd("lunch 0")).toBeNull();
  });
});
