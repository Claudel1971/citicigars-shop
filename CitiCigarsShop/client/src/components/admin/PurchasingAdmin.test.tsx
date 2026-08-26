import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PurchaseOrderProgress, ReceiptConfirmation } from "./PurchasingAdmin";

describe("Milestone 8 purchasing UI", () => {
  const order = { purchaseOrderCode: "PO-1", supplierCode: "SUP", supplierName: "Supplier", items: [{ purchaseOrderItemId: "i", sku: "SKU", type: "Pack", packSize: 5, orderedQuantity: 10, receivedQuantity: 6, outstandingQuantity: 4 }] };
  it("shows ordered, received, and outstanding quantities for partial receipts", () => {
    const html = renderToStaticMarkup(<PurchaseOrderProgress order={order}/>);
    expect(html).toContain("commandé 10"); expect(html).toContain("reçu 6"); expect(html).toContain("restant 4");
  });
  it("shows explicit destination, exact identity, and lot-per-line confirmation", () => {
    const html = renderToStaticMarkup(<ReceiptConfirmation order={order} destination={{ code: "STORE", name: "Cave" }} lines={[{ ...order.items[0], receivedQuantity: 4 }]}/>);
    expect(html).toContain("STORE — Cave"); expect(html).toContain("Pack(5)"); expect(html).toContain("lot de provenance neuf"); expect(html).toContain("Aucune augmentation optimiste");
  });
});
