import { describe, expect, it } from "vitest";
import {
  ZERO_BALANCE,
  applyEffects,
  effectsForTransfertInterne,
  effectsForAnnulationVente,
  planDeterministicLotAllocation,
} from "./stock-movement-processor";
process.env.MYSQL_URL = process.env.MYSQL_URL || "mysql://root@127.0.0.1:3399/not_used_by_pure_close04_tests";
const { physicalBundlePackSize, planBundleComponents } = await import("./stock-close04");
const { planSaleCompensationLegs } = await import("./manual-sale");

describe("CLOSE-04 transfer interne", () => {
  it("keeps aggregate stock unchanged while requiring enough unreserved onHand", () => {
    const before = { ...ZERO_BALANCE, onHand: 7, reservedClient: 2 };
    const effects = effectsForTransfertInterne(3, before);
    expect(effects).toEqual([
      { balanceField: "onHand", delta: -3 },
      { balanceField: "onHand", delta: 3 },
    ]);
    expect(applyEffects(before, effects)).toEqual(before);
    expect(() => effectsForTransfertInterne(6, before)).toThrowError(
      expect.objectContaining({ code: "insufficient_availability_for_transfer" }),
    );
  });

  it("uses evidenced FIFO and preserves exact source lots for the destination", () => {
    const allocations = planDeterministicLotAllocation([
      { lotId: "lot-new", originKind: "RECEIPT", receivedAt: new Date("2026-09-02"), createdAt: new Date("2026-09-02"), eligibleQty: 5 },
      { lotId: "lot-old", originKind: "RECEIPT", receivedAt: new Date("2026-08-01"), createdAt: new Date("2026-08-01"), eligibleQty: 2 },
    ], 4);
    expect(allocations).toEqual([
      { lotId: "lot-old", qty: 2 },
      { lotId: "lot-new", qty: 2 },
    ]);
  });
});

describe("CLOSE-04 décomposition physique bundle/sampler", () => {
  const items = [
    { productSku: "CTCG-NI-A", quantite: 2 },
    { productSku: "CTCG-NI-B", quantite: 1 },
    { productSku: "CTCG-NI-A", quantite: 1 },
  ];

  it("derives the physical Pack size from composition and expands components without double counting", () => {
    expect(physicalBundlePackSize(items)).toBe(4);
    expect(planBundleComponents(items, 2)).toEqual([
      { sku: "CTCG-NI-A", qty: 6 },
      { sku: "CTCG-NI-B", qty: 2 },
    ]);
  });

  it("fails closed when a component has no stock SKU", () => {
    expect(() => planBundleComponents([{ productSku: null, quantite: 1 }], 1))
      .toThrowError(expect.objectContaining({ code: "bundle_component_stock_identity_missing" }));
  });
});

describe("CLOSE-04 annulation compensatoire de vente", () => {
  it("restores the exact sold lots and locations instead of running a new FIFO", () => {
    const legs = planSaleCompensationLegs(
      { orderItemId: "SALE-1-01", sku: "CTCG-NI-A", stockType: "Box", stockPackSize: 0, quantity: 3 },
      [
        { lotId: "LOT-B", locationId: "LOC-2", balanceField: "onHand", qtyDelta: -1, sku: "CTCG-NI-A", type: "Box", packSize: 0 },
        { lotId: "LOT-A", locationId: "LOC-1", balanceField: "onHand", qtyDelta: -2, sku: "CTCG-NI-A", type: "Box", packSize: 0 },
        { lotId: "LOT-A", locationId: "LOC-1", balanceField: "reservedClient", qtyDelta: -2, sku: "CTCG-NI-A", type: "Box", packSize: 0 },
      ],
    );
    expect(legs).toEqual([
      { sku: "CTCG-NI-A", type: "Box", packSize: 0, quantity: 2, destinationLocationId: "LOC-1", lotId: "LOT-A" },
      { sku: "CTCG-NI-A", type: "Box", packSize: 0, quantity: 1, destinationLocationId: "LOC-2", lotId: "LOT-B" },
    ]);
  });

  it("records compensation as positive append-only onHand effect", () => {
    expect(effectsForAnnulationVente(2)).toEqual([{ balanceField: "onHand", delta: 2 }]);
    expect(() => effectsForAnnulationVente(0)).toThrowError(
      expect.objectContaining({ code: "invalid_sale_compensation_quantity" }),
    );
  });
});
