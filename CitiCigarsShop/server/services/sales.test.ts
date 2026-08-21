import { describe, it, expect } from "vitest";
import {
  computeOrder,
  snapshotBundleComponents,
  computeMaxBundlesAvailable,
} from "./sales";

describe("computeOrder — cascade promo -> remise -> marge (brief section 7)", () => {
  it("matches the brief's worked example exactly", () => {
    // ligne A après promo = 18 000 ; ligne B = 30 000 ; remise = 4 800 (10%)
    // A: remise additionnelle 1 800 -> revenu réel 16 200
    // B: remise additionnelle 3 000 -> revenu réel 27 000
    const result = computeOrder(
      [
        { itemType: "PRODUCT", sku: "A", quantity: 1, regularUnitPriceXaf: 18000, promoUnitPriceXaf: null },
        { itemType: "PRODUCT", sku: "B", quantity: 1, regularUnitPriceXaf: 30000, promoUnitPriceXaf: null },
      ],
      4800
    );

    expect(result.subtotalAfterDiscountsXaf).toBe(48000);
    expect(result.items[0].allocatedOrderDiscountXaf).toBe(1800);
    expect(result.items[0].actualLineRevenueXaf).toBe(16200);
    expect(result.items[1].allocatedOrderDiscountXaf).toBe(3000);
    expect(result.items[1].actualLineRevenueXaf).toBe(27000);
    expect(result.finalSaleTotalXaf).toBe(43200);
  });

  it("produit sans promo", () => {
    const result = computeOrder(
      [{ itemType: "PRODUCT", sku: "A", quantity: 2, regularUnitPriceXaf: 10000, promoUnitPriceXaf: null }],
      0
    );
    expect(result.items[0].effectiveUnitPriceXaf).toBe(10000);
    expect(result.items[0].lineSubtotalXaf).toBe(20000);
    expect(result.productDiscountsTotalXaf).toBe(0);
  });

  it("produit avec promo", () => {
    const result = computeOrder(
      [{ itemType: "PRODUCT", sku: "A", quantity: 2, regularUnitPriceXaf: 10000, promoUnitPriceXaf: 8000 }],
      0
    );
    expect(result.items[0].effectiveUnitPriceXaf).toBe(8000);
    expect(result.productDiscountsTotalXaf).toBe(4000); // (10000-8000)*2
    expect(result.finalSaleTotalXaf).toBe(16000);
  });

  it("commande mixte promo + non promo, avec remise supplémentaire", () => {
    const result = computeOrder(
      [
        { itemType: "PRODUCT", sku: "A", quantity: 1, regularUnitPriceXaf: 10000, promoUnitPriceXaf: 8000 },
        { itemType: "PRODUCT", sku: "B", quantity: 1, regularUnitPriceXaf: 20000, promoUnitPriceXaf: null },
      ],
      2000
    );
    // sum of line revenues must equal final order total exactly (rounding
    // reconciled on the last line)
    const sumLineRevenue = result.items.reduce((s, i) => s + i.actualLineRevenueXaf, 0);
    expect(sumLineRevenue).toBe(result.finalSaleTotalXaf);
  });

  it("allocation proportionnelle exacte avec arrondis sur N lignes", () => {
    // 3 lines chosen to force rounding (subtotal not evenly divisible)
    const result = computeOrder(
      [
        { itemType: "PRODUCT", sku: "A", quantity: 1, regularUnitPriceXaf: 1000, promoUnitPriceXaf: null },
        { itemType: "PRODUCT", sku: "B", quantity: 1, regularUnitPriceXaf: 3000, promoUnitPriceXaf: null },
        { itemType: "PRODUCT", sku: "C", quantity: 1, regularUnitPriceXaf: 7000, promoUnitPriceXaf: null },
      ],
      333 // awkward amount to force rounding
    );
    const sumDiscounts = result.items.reduce((s, i) => s + i.allocatedOrderDiscountXaf, 0);
    expect(sumDiscounts).toBe(333); // reconciled exactly via last-line adjustment
    const sumLineRevenue = result.items.reduce((s, i) => s + i.actualLineRevenueXaf, 0);
    expect(sumLineRevenue).toBe(result.finalSaleTotalXaf);
  });

  it("refuse une remise supérieure au sous-total après promo", () => {
    expect(() =>
      computeOrder(
        [{ itemType: "PRODUCT", sku: "A", quantity: 1, regularUnitPriceXaf: 1000, promoUnitPriceXaf: null }],
        5000
      )
    ).toThrow();
  });

  it("refuse une liste de lignes vide", () => {
    expect(() => computeOrder([], 0)).toThrow();
  });

  it("Phase 2: coût et marge restent null (jamais inventés)", () => {
    const result = computeOrder(
      [{ itemType: "PRODUCT", sku: "A", quantity: 1, regularUnitPriceXaf: 1000, promoUnitPriceXaf: null }],
      0
    );
    expect(result.items[0].unitCostAtSaleXaf).toBeNull();
    expect(result.items[0].totalCostXaf).toBeNull();
    expect(result.items[0].lineMarginXaf).toBeNull();
  });
});

describe("bundle handling", () => {
  it("snapshotBundleComponents fige la composition au moment de la vente", () => {
    const snapshot = snapshotBundleComponents(3, [
      { productSku: "CIGAR-A", quantityPerBundle: 2 },
      { productSku: "CIGAR-B", quantityPerBundle: 1 },
    ]);
    expect(snapshot).toEqual([
      { productSku: "CIGAR-A", quantityPerBundle: 2, totalQuantity: 6 },
      { productSku: "CIGAR-B", quantityPerBundle: 1, totalQuantity: 3 },
    ]);
  });

  it("computeMaxBundlesAvailable = MIN(stock composant / quantité requise), jamais stocké", () => {
    const composition = [
      { productSku: "CIGAR-A", quantityPerBundle: 2 },
      { productSku: "CIGAR-B", quantityPerBundle: 3 },
    ];
    // A: 10 available / 2 per bundle = 5 possible
    // B: 9 available / 3 per bundle = 3 possible  <- limiting component
    const max = computeMaxBundlesAvailable(composition, { "CIGAR-A": 10, "CIGAR-B": 9 });
    expect(max).toBe(3);
  });

  it("composant manquant du stock -> 0 bundle réalisable", () => {
    const composition = [{ productSku: "CIGAR-A", quantityPerBundle: 2 }];
    const max = computeMaxBundlesAvailable(composition, {});
    expect(max).toBe(0);
  });
});
