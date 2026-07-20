import { describe, expect, it } from "vitest";
import { BRAND_REGISTRY, resolveBrand } from "@/lib/brands/registry";

/**
 * Brand resolution decides the category on every imported row, so a wrong
 * answer here is a wrong answer on a statement the user then has to fix by
 * hand — which is exactly the manual work the app exists to remove.
 */

describe("resolveBrand — specificity", () => {
  it("prefers the more specific brand over a shorter one that also matches", () => {
    // Both "amazon" and "amazon prime video" appear in this string. The
    // longer claim is the true one.
    expect(resolveBrand("AMAZON PRIME VIDEO")?.category).toBe("Entertainment");
    expect(resolveBrand("UPI/AMAZON PRIME/12345")?.category).toBe("Entertainment");
  });

  it("still resolves the plain brand when nothing more specific matches", () => {
    expect(resolveBrand("AMAZON RETAIL INDIA")?.id).toBe("amazon");
  });

  it("files a Swiggy Instamart run as groceries, not as a food order", () => {
    const brand = resolveBrand("SWIGGY INSTAMART ORDER 8891");
    expect(brand?.id).toBe("instamart");
    expect(brand?.category).toBe("Shopping");
  });

  it("still files a plain Swiggy order as Food", () => {
    expect(resolveBrand("SWIGGY LIMITED BANGALORE")?.category).toBe("Food");
  });

  it("resolves nothing rather than guessing", () => {
    expect(resolveBrand("NEFT/SOME RANDOM PERSON")).toBeNull();
    expect(resolveBrand("")).toBeNull();
  });
});

describe("resolveBrand — registry integrity", () => {
  it("is independent of declaration order", () => {
    // The old implementation returned the first match in array order, so a
    // brand appended above another could silently shadow it. Assert the
    // property directly: every brand must resolve to itself from its own name.
    for (const brand of BRAND_REGISTRY) {
      expect(resolveBrand(brand.name)?.id, `${brand.name} resolves to itself`).toBe(brand.id);
    }
  });

  it("resolves every alias to the brand that declares it", () => {
    for (const brand of BRAND_REGISTRY) {
      for (const alias of brand.aliases) {
        expect(resolveBrand(alias)?.id, `alias "${alias}" of ${brand.id}`).toBe(brand.id);
      }
    }
  });

  it("has no duplicate ids", () => {
    const ids = BRAND_REGISTRY.map((brand) => brand.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
