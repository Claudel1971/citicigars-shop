import { describe, expect, it } from "vitest";
import { validateManualSaleLine, type ManualSaleLineInput } from "./manual-sale";

const location = "11111111-1111-4111-8111-111111111111";
const base: ManualSaleLineInput = {
  itemType: "PRODUCT",
  sku: "CTCG-NI-M7",
  quantity: 1,
  regularUnitPriceXaf: 10_000,
  stockDisposition: "CONSUME",
  stockType: "Box",
  stockPackSize: 0,
  sourceLocationId: location,
};

describe("Milestone 7 manual sale stock contract", () => {
  it("preserves an exact Box identity and explicit source", () => {
    expect(validateManualSaleLine(base, 0)).toMatchObject({
      sku: "CTCG-NI-M7", stockType: "Box", stockPackSize: 0, sourceLocationId: location,
    });
  });

  it("keeps Pack distinct and requires its exact positive size", () => {
    expect(validateManualSaleLine({ ...base, stockType: "Pack", stockPackSize: 5 }, 0).stockPackSize).toBe(5);
    expect(() => validateManualSaleLine({ ...base, stockType: "Pack", stockPackSize: 0 }, 0)).toThrow("strictement positif");
  });

  it("fails closed for missing identity or source location", () => {
    expect(() => validateManualSaleLine({ ...base, stockType: null }, 0)).toThrow("type de stock exact requis");
    expect(() => validateManualSaleLine({ ...base, stockPackSize: null }, 0)).toThrow("packSize exact requis");
    expect(() => validateManualSaleLine({ ...base, sourceLocationId: null }, 0)).toThrow("emplacement source explicite requis");
  });

  it("classifies noncommercial lines explicitly without physical facts", () => {
    expect(validateManualSaleLine({
      ...base, itemType: "SERVICE", sku: "CTCG-SRV-VAL", stockDisposition: "NON_STOCK",
      stockType: null, stockPackSize: null, sourceLocationId: null, nonStockReason: "SERVICE_NON_PHYSIQUE",
    }, 0)).toMatchObject({ stockDisposition: "NON_STOCK", stockType: null, sourceLocationId: null });
    expect(() => validateManualSaleLine({ ...base, itemType: "SERVICE" }, 0)).toThrow("NON_STOCK");
  });

  it("rejects ambiguous bundles and zero-revenue stock records", () => {
    expect(() => validateManualSaleLine({ ...base, itemType: "BUNDLE" }, 0)).toThrow("bundles sont bloqués");
    expect(() => validateManualSaleLine({ ...base, regularUnitPriceXaf: 0 }, 0)).toThrow("revenu nul");
  });
});
