import { describe, expect, it } from "vitest";
import {
  assertCashClearedForCancellation,
  calculateFifoCogs,
  netCashBalance,
  signedCashAmount,
} from "./finance-close05";

process.env.MYSQL_URL = process.env.MYSQL_URL || "mysql://root@127.0.0.1:3399/not_used_by_close05_tests";
const { deriveBundleLooseUnitCost } = await import("./stock-close04");
const { normalizeAcquisitionUnitCost } = await import("./purchasing");

describe("CLOSE-05 append-only cash journal contract", () => {
  it("uses positive receipt/refund amounts with type carrying the sign", () => {
    expect(signedCashAmount("RECEIPT", 12_000)).toBe(12_000);
    expect(signedCashAmount("REFUND", 12_000)).toBe(-12_000);
    expect(netCashBalance([
      { entryType: "RECEIPT", amountXaf: 12_000 },
      { entryType: "REFUND", amountXaf: 5_000 },
    ])).toBe(7_000);
  });

  it("blocks cancellation until recorded cash is fully compensated", () => {
    expect(() => assertCashClearedForCancellation(10_000, []))
      .toThrow("journal de caisse absent");
    expect(() => assertCashClearedForCancellation(10_000, [
      { entryType: "RECEIPT", amountXaf: 10_000 },
      { entryType: "REFUND", amountXaf: 4_000 },
    ])).toThrow("remboursement append-only requis");
    expect(assertCashClearedForCancellation(10_000, [
      { entryType: "RECEIPT", amountXaf: 10_000 },
      { entryType: "REFUND", amountXaf: 10_000 },
    ])).toBe(0);
  });
});

describe("CLOSE-05 FIFO COGS", () => {
  it("calculates COGS from the exact sold lot allocations, including mixed lot costs", () => {
    const result = calculateFifoCogs([
      { lotId: "LOT-OLD", sku: "SKU-1", type: "Pack", packSize: 5, qtyDelta: -2, balanceField: "onHand" },
      { lotId: "LOT-NEW", sku: "SKU-1", type: "Pack", packSize: 5, qtyDelta: -1, balanceField: "onHand" },
      { lotId: "LOT-OLD", sku: "SKU-1", type: "Pack", packSize: 5, qtyDelta: -1, balanceField: "reservedClient" },
    ], [
      { lotId: "LOT-OLD", sku: "SKU-1", type: "Pack", packSize: 5, unitCostXaf: "4500.0000" },
      { lotId: "LOT-NEW", sku: "SKU-1", type: "Pack", packSize: 5, unitCostXaf: "6000.0000" },
    ]);
    expect(result).toEqual({
      known: true,
      totalCostXaf: 15_000,
      quantity: 3,
      weightedUnitCostXaf: 5_000,
    });
  });

  it("fails closed when even one consumed lot has no cost basis", () => {
    const result = calculateFifoCogs([
      { lotId: "LOT-A", sku: "SKU-1", type: "Box", packSize: 0, qtyDelta: -1, balanceField: "onHand" },
      { lotId: "LOT-B", sku: "SKU-1", type: "Box", packSize: 0, qtyDelta: -1, balanceField: "onHand" },
    ], [
      { lotId: "LOT-A", sku: "SKU-1", type: "Box", packSize: 0, unitCostXaf: 20_000 },
    ]);
    expect(result.known).toBe(false);
    if (!result.known) expect(result.missing).toEqual([
      { lotId: "LOT-B", sku: "SKU-1", type: "Box", packSize: 0 },
    ]);
  });
});

describe("CLOSE-05 acquisition and sampler cost basis", () => {
  it("accepts only explicit positive acquisition cost and keeps four-decimal precision", () => {
    expect(normalizeAcquisitionUnitCost(12_345.67891)).toBe(12_345.6789);
    expect(normalizeAcquisitionUnitCost(null)).toBeNull();
    expect(() => normalizeAcquisitionUnitCost(0)).toThrowError(expect.objectContaining({ code: "invalid_acquisition_unit_cost" }));
  });

  it("allocates a purchased sampler Pack cost equally per physical cigar", () => {
    expect(deriveBundleLooseUnitCost(24_000, 6)).toBe(4_000);
    expect(deriveBundleLooseUnitCost(10_000, 3)).toBe(3_333.3333);
  });
});
