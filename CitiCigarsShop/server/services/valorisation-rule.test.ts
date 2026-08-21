import { describe, it, expect } from "vitest";
import { computeValorisationLine, CTCG_SRV_VAL_SKU } from "./valorisation-rule";

describe("CTCG-SRV-VAL — règle live, non rétroactive", () => {
  it("VAL > 0 : crée une ligne du montant de l'écart positif", () => {
    const result = computeValorisationLine(100000, [
      { sku: "A", normalSellingPriceXaf: 30000, quantity: 1 },
      { sku: "B", normalSellingPriceXaf: 40000, quantity: 1 },
    ]);
    expect(result.valLineAmountXaf).toBe(30000);
  });

  it("VAL = 0 : aucune ligne", () => {
    const result = computeValorisationLine(70000, [
      { sku: "A", normalSellingPriceXaf: 30000, quantity: 1 },
      { sku: "B", normalSellingPriceXaf: 40000, quantity: 1 },
    ]);
    expect(result.valLineAmountXaf).toBeNull();
  });

  it("VAL < 0 : jamais de ligne négative", () => {
    const result = computeValorisationLine(50000, [
      { sku: "A", normalSellingPriceXaf: 30000, quantity: 1 },
      { sku: "B", normalSellingPriceXaf: 40000, quantity: 1 },
    ]);
    expect(result.valLineAmountXaf).toBeNull();
    expect(result.rawDifferenceXaf).toBe(-20000);
  });

  it("tient compte des quantités par composant", () => {
    const result = computeValorisationLine(200000, [{ sku: "A", normalSellingPriceXaf: 30000, quantity: 3 }]);
    expect(result.sumOfComponentSellingPricesXaf).toBe(90000);
    expect(result.valLineAmountXaf).toBe(110000);
  });

  it("SKU constant exposé", () => {
    expect(CTCG_SRV_VAL_SKU).toBe("CTCG-SRV-VAL");
  });
});
