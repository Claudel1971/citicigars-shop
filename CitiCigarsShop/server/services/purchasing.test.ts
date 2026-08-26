import { describe, expect, it } from "vitest";

process.env.MYSQL_URL ||= "mysql://root@127.0.0.1:3399/citicigars_rehearsal";
const { createReceipt, PurchasingRuleError, validatePurchaseIdentity, validateSupplierInput } = await import("./purchasing");

describe("Milestone 8 purchasing validation", () => {
  it("preserves exact Box and Pack identities", () => {
    expect(validatePurchaseIdentity({ sku: "BOX", type: "Box", packSize: 0 }, 10, "qty")).toEqual({ sku: "BOX", type: "Box", packSize: 0, quantity: 10 });
    expect(validatePurchaseIdentity({ sku: "PACK", type: "Pack", packSize: 5 }, 6, "qty")).toEqual({ sku: "PACK", type: "Pack", packSize: 5, quantity: 6 });
  });
  it("fails closed for invalid sentinel and non-positive quantities", () => {
    for (const input of [
      { sku: "P", type: "Pack" as const, packSize: 0 },
      { sku: "B", type: "Box" as const, packSize: 5 },
    ]) expect(() => validatePurchaseIdentity(input, 1, "qty")).toThrowError(expect.objectContaining({ code: "invalid_pack_size_for_stock_type" }));
    expect(() => validatePurchaseIdentity({ sku: "B", type: "Box", packSize: 0 }, 0, "qty"))
      .toThrowError(expect.objectContaining({ code: "qty" }));
  });
  it("returns stable domain errors", () => {
    expect(new PurchasingRuleError("over_receipt_blocked")).toMatchObject({ code: "over_receipt_blocked" });
  });
  it("normalizes valid supplier evidence and rejects ambiguous supplier identity", () => {
    expect(validateSupplierInput({ code: " sup_01 ", name: " Supplier A " })).toMatchObject({ code: "SUP_01", name: "Supplier A" });
    expect(() => validateSupplierInput({ code: "", name: "Supplier" })).toThrowError(expect.objectContaining({ code: "invalid_supplier_code" }));
    expect(() => validateSupplierInput({ code: "SUP", name: "" })).toThrowError(expect.objectContaining({ code: "invalid_supplier_name" }));
  });
  it("requires explicit PO evidence and destination before any receipt transaction", async () => {
    const base = { clientRequestId: "11111111-1111-4111-8111-111111111111", receivedAt: "2026-01-01T00:00:00Z", author: "operator", lines: [] };
    await expect(createReceipt({ ...base, purchaseOrderId: "", destinationLocationId: "22222222-2222-4222-8222-222222222222" } as any))
      .rejects.toMatchObject({ code: "purchase_order_required" });
    await expect(createReceipt({ ...base, purchaseOrderId: "33333333-3333-4333-8333-333333333333", destinationLocationId: "" } as any))
      .rejects.toMatchObject({ code: "destination_location_required" });
  });
});
