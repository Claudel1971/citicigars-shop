import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

describe("CLOSE-07 live staging Stock/Finance qualification", () => {
  let db: any;
  let skus: any;
  let stockLocations: any;
  let stockBalances: any;
  let stockMovementGroups: any;
  let stockMovementLotAllocations: any;
  let products: any;
  let customers: any;
  let orders: any;
  let createSupplier: any;
  let createPurchaseOrder: any;
  let createReceipt: any;
  let createManualSale: any;
  let refundManualSaleCash: any;
  let cancelManualSale: any;
  let getOrderCashState: any;

  beforeAll(async () => {
    ({ db } = await import("../db.mysql"));
    ({ skus, stockLocations, stockBalances, stockMovementGroups, stockMovementLotAllocations } = await import("../../shared/schema.stock"));
    ({ products } = await import("../../shared/schema.mysql"));
    ({ customers } = await import("../../shared/schema.crm"));
    ({ orders } = await import("../../shared/schema.sales"));
    ({ createSupplier, createPurchaseOrder, createReceipt } = await import("./purchasing"));
    ({ createManualSale, refundManualSaleCash, cancelManualSale } = await import("./manual-sale"));
    ({ getOrderCashState } = await import("./finance-close05"));
  });

  it("TEST receipt cost -> FIFO sale -> cash gate -> refund -> exact stock cancellation", async () => {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
    const sku = `C07T-${suffix}`;
    const locationId = randomUUID();
    const customerId = randomUUID();

    await db.insert(skus).values({ sku, kind: "CIGAR" });
    await db.insert(products).values({
      sku,
      marque: "CLOSE07-TEST",
      ligne: "Qualification",
      vitole: "Toro",
      inCatalogue: false,
    });
    await db.insert(stockLocations).values({
      locationId,
      code: `C07T-${suffix}`,
      name: "CLOSE07 TEST staging location",
      category: "CITI_STORAGE",
      active: true,
      isSystem: false,
    });
    await db.insert(customers).values({
      customerId,
      firstName: "CLOSE07",
      lastName: "TEST",
      status: "PROSPECT",
      isInternal: true,
      isBlacklisted: false,
      notes: "Synthetic staging-only qualification record",
    });

    const supplier = await createSupplier({
      code: `C07T-SUP-${suffix}`,
      name: `CLOSE07 TEST Supplier ${suffix}`,
    });

    const po = await createPurchaseOrder({
      clientRequestId: randomUUID(),
      supplierId: supplier.supplierId,
      orderedAt: "2026-09-27T02:15:00.000Z",
      createdBy: "CLOSE07-TEST",
      lines: [{ sku, type: "Box", packSize: 0, orderedQuantity: 10 }],
    });
    expect(po.items).toHaveLength(1);

    const receipt = await createReceipt({
      clientRequestId: randomUUID(),
      purchaseOrderId: po.purchaseOrderId,
      destinationLocationId: locationId,
      receivedAt: "2026-09-27T02:20:00.000Z",
      author: "CLOSE07-TEST",
      invoiceReference: `C07T-INV-${suffix}`,
      lines: [{
        purchaseOrderItemId: po.items[0].purchaseOrderItemId,
        sku,
        type: "Box",
        packSize: 0,
        receivedQuantity: 10,
        acquisitionUnitCostXaf: 5_000,
      }],
    });
    expect(receipt.items[0].acquisitionUnitCostXaf).toBe("5000.0000");

    const [afterReceipt] = await db.select().from(stockBalances).where(and(
      eq(stockBalances.sku, sku),
      eq(stockBalances.type, "Box"),
      eq(stockBalances.packSize, 0),
    ));
    expect(afterReceipt.onHandQty).toBe(10);

    const sale = await createManualSale({
      clientRequestId: randomUUID(),
      author: "CLOSE07-TEST",
      customerId,
      orderDate: "2026-09-27T02:25:00.000Z",
      amountPaid: 20_000,
      paymentDate: "2026-09-27T02:25:00.000Z",
      lines: [{
        itemType: "PRODUCT",
        sku,
        quantity: 2,
        regularUnitPriceXaf: 10_000,
        stockDisposition: "CONSUME",
        stockType: "Box",
        stockPackSize: 0,
        sourceLocationId: locationId,
      }],
    });

    expect(sale.cogsKnown).toBe(true);
    expect(sale.status).toBe("PAID");

    const [soldOrder] = await db.select().from(orders).where(eq(orders.orderId, sale.orderId));
    expect(soldOrder.totalCostXaf).toBe(10_000);
    expect(soldOrder.grossMarginXaf).toBe(10_000);
    expect(Number(soldOrder.grossMarginRate)).toBeCloseTo(0.5, 4);

    const [afterSale] = await db.select().from(stockBalances).where(and(
      eq(stockBalances.sku, sku),
      eq(stockBalances.type, "Box"),
      eq(stockBalances.packSize, 0),
    ));
    expect(afterSale.onHandQty).toBe(8);

    const cashAfterSale = await getOrderCashState(sale.orderId);
    expect(cashAfterSale.balanceXaf).toBe(20_000);
    expect(cashAfterSale.entries.map((entry: any) => entry.entryType)).toEqual(["RECEIPT"]);

    await expect(cancelManualSale(sale.orderId, "CLOSE07-TEST", "TEST pre-refund cancellation must fail"))
      .rejects.toThrow("remboursement append-only requis");

    const refund = await refundManualSaleCash({
      orderId: sale.orderId,
      clientRequestId: randomUUID(),
      amountXaf: 20_000,
      author: "CLOSE07-TEST",
      refundDate: "2026-09-27T02:30:00.000Z",
      reason: "CLOSE07 TEST full refund before cancellation",
    });
    expect(refund.balanceXaf).toBe(0);

    const cancelled = await cancelManualSale(
      sale.orderId,
      "CLOSE07-TEST",
      "CLOSE07 TEST exact-lot cancellation after refund",
    );
    expect(cancelled.status).toBe("CANCELLED");

    const [afterCancellation] = await db.select().from(stockBalances).where(and(
      eq(stockBalances.sku, sku),
      eq(stockBalances.type, "Box"),
      eq(stockBalances.packSize, 0),
    ));
    expect(afterCancellation.onHandQty).toBe(10);

    const saleGroups = await db.select().from(stockMovementGroups).where(and(
      eq(stockMovementGroups.movementType, "VENTE"),
      eq(stockMovementGroups.referenceId, sale.orderId),
    ));
    const cancellationGroups = await db.select().from(stockMovementGroups).where(and(
      eq(stockMovementGroups.movementType, "ANNULATION_VENTE"),
      eq(stockMovementGroups.referenceId, sale.orderId),
    ));
    expect(saleGroups).toHaveLength(1);
    expect(cancellationGroups).toHaveLength(1);

    const saleLots = await db.select({
      lotId: stockMovementLotAllocations.lotId,
      qtyDelta: stockMovementLotAllocations.qtyDelta,
    }).from(stockMovementLotAllocations)
      .where(eq(stockMovementLotAllocations.groupId, saleGroups[0].groupId));
    const cancellationLots = await db.select({
      lotId: stockMovementLotAllocations.lotId,
      qtyDelta: stockMovementLotAllocations.qtyDelta,
    }).from(stockMovementLotAllocations)
      .where(eq(stockMovementLotAllocations.groupId, cancellationGroups[0].groupId));

    expect(saleLots.filter((x: any) => x.qtyDelta < 0).map((x: any) => [x.lotId, x.qtyDelta]))
      .toEqual(cancellationLots.filter((x: any) => x.qtyDelta > 0).map((x: any) => [x.lotId, -x.qtyDelta]));

    const cashAfterCancellation = await getOrderCashState(sale.orderId);
    expect(cashAfterCancellation.balanceXaf).toBe(0);
    expect(cashAfterCancellation.entries.map((entry: any) => entry.entryType).sort())
      .toEqual(["RECEIPT", "REFUND"]);

    const [cancelledOrder] = await db.select().from(orders).where(eq(orders.orderId, sale.orderId));
    expect(cancelledOrder.status).toBe("CANCELLED");
    expect(cancelledOrder.totalCostXaf).toBe(10_000);
    expect(cancelledOrder.grossMarginXaf).toBe(10_000);
    expect(Number(cancelledOrder.grossMarginRate)).toBeCloseTo(0.5, 4);

    console.log(JSON.stringify({
      marker: "CLOSE07-TEST",
      sku,
      orderId: sale.orderId,
      finalStock: afterCancellation.onHandQty,
      cashBalance: cashAfterCancellation.balanceXaf,
      orderStatus: cancelledOrder.status,
      cogsXaf: cancelledOrder.totalCostXaf,
      grossMarginXaf: cancelledOrder.grossMarginXaf,
    }, null, 2));
  });
});
