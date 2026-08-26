// Milestone 8 real-MariaDB rehearsal. Disposable local database only.
process.env.MYSQL_URL = "mysql://root@127.0.0.1:3399/citicigars_rehearsal";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";

let pass = 0, fail = 0;
const check = (condition, message, detail = "") => condition ? (pass++, console.log(`OK: ${message}`)) : (fail++, console.error(`FAIL: ${message}${detail ? ` — ${detail}` : ""}`));
const { db } = await import("../server/db.mysql.ts");
const { createSupplier, createPurchaseOrder, createReceipt, getPurchaseOrder } = await import("../server/services/purchasing.ts");
const { createManualSale } = await import("../server/services/manual-sale.ts");
const { getStockTraceability } = await import("../server/services/stock-traceability.ts");
const { and, eq } = await import("drizzle-orm");
const { customers } = await import("../shared/schema.crm.ts");
const { orders } = await import("../shared/schema.sales.ts");
const { products } = await import("../shared/schema.mysql.ts");
const {
  skus, cigarCatalog, stockBalances, stockLocations, stockLocationBalances, stockLotLocationBalances,
  stockPurchaseOrders, stockReceipts, stockReceiptItems, stockProvenanceLots, stockMovementGroups,
  stockMovements, stockMovementLotAllocations,
} = await import("../shared/schema.stock.ts");

const run = Date.now().toString(36).toUpperCase();
const BOX_SKU = `M8B-${run}`, PACK_SKU = `M8P-${run}`, ROLLBACK_SKU = `M8R-${run}`;
const STORE = randomUUID(), CUSTOMER = randomUUID();

async function counts() { return {
  receipts: (await db.select().from(stockReceipts)).length, receiptItems: (await db.select().from(stockReceiptItems)).length,
  lots: (await db.select().from(stockProvenanceLots)).length, groups: (await db.select().from(stockMovementGroups)).length,
  movements: (await db.select().from(stockMovements)).length, allocations: (await db.select().from(stockMovementLotAllocations)).length,
}; }
async function onHand(sku, type, packSize) {
  const [a] = await db.select().from(stockBalances).where(and(eq(stockBalances.sku, sku), eq(stockBalances.type, type), eq(stockBalances.packSize, packSize)));
  const [l] = await db.select().from(stockLocationBalances).where(and(eq(stockLocationBalances.locationId, STORE), eq(stockLocationBalances.sku, sku), eq(stockLocationBalances.type, type), eq(stockLocationBalances.packSize, packSize)));
  const lots = await db.select().from(stockLotLocationBalances).where(and(eq(stockLotLocationBalances.locationId, STORE), eq(stockLotLocationBalances.sku, sku), eq(stockLotLocationBalances.type, type), eq(stockLotLocationBalances.packSize, packSize)));
  return { aggregate: a?.onHandQty || 0, location: l?.onHandQty || 0, lots: lots.reduce((sum, row) => sum + row.onHandQty, 0) };
}

console.log("=== Milestone 8 Purchasing / Receiving disposable MariaDB rehearsal ===");
await db.insert(skus).values([{ sku: BOX_SKU, kind: "CIGAR" }, { sku: PACK_SKU, kind: "CIGAR" }, { sku: ROLLBACK_SKU, kind: "CIGAR" }]);
for (const [index, sku] of [BOX_SKU, PACK_SKU, ROLLBACK_SKU].entries()) {
  const cigarId = `M8${index}${run}`.slice(0, 20);
  await db.insert(cigarCatalog).values({ cigarId, marque: "M8", ligne: "Receiving", vitole: String(index) });
  await db.insert(products).values({ sku, cigarId, marque: "M8", ligne: "Receiving", vitole: String(index) });
}
await db.insert(stockLocations).values({ locationId: STORE, code: `M8_STORE_${run}`, name: "M8 Store", category: "CITI_STORAGE" });
await db.insert(customers).values({ customerId: CUSTOMER, firstName: "M8", lastName: "FIFO", status: "PROSPECT" });
const supplierA = await createSupplier({ code: `M8A_${run}`, name: "M8 Supplier A" });
const supplierB = await createSupplier({ code: `M8B_${run}`, name: "M8 Supplier B" });
check(!!supplierA.supplierId && !!supplierB.supplierId, "supplier A and B created as explicit evidence");

const po = await createPurchaseOrder({
  clientRequestId: randomUUID(), supplierId: supplierA.supplierId, orderedAt: "2026-01-01T10:00:00Z", expectedAt: "2026-01-10T10:00:00Z",
  purchaseReference: `EXT-${run}`, createdBy: "m8-rehearsal",
  lines: [
    { sku: BOX_SKU, type: "Box", packSize: 0, orderedQuantity: 10 },
    { sku: PACK_SKU, type: "Pack", packSize: 5, orderedQuantity: 6 },
  ],
});
const boxItem = po.items.find((item) => item.sku === BOX_SKU), packItem = po.items.find((item) => item.sku === PACK_SKU);
check(po.status === "ORDERED" && boxItem.outstandingQuantity === 10 && packItem.outstandingQuantity === 6, "PO-1 stores exact ordered identities and outstanding quantities");

const firstRequest = randomUUID();
const firstInput = {
  clientRequestId: firstRequest, purchaseOrderId: po.purchaseOrderId, destinationLocationId: STORE,
  receivedAt: "2026-01-05T10:00:00Z", author: "m8-rehearsal", invoiceReference: `INV-1-${run}`,
  lines: [
    { purchaseOrderItemId: boxItem.purchaseOrderItemId, sku: BOX_SKU, type: "Box", packSize: 0, receivedQuantity: 6 },
    { purchaseOrderItemId: packItem.purchaseOrderItemId, sku: PACK_SKU, type: "Pack", packSize: 5, receivedQuantity: 2 },
  ],
};
const first = await createReceipt(firstInput);
check(first.purchaseOrderStatus === "PARTIALLY_RECEIVED" && first.items.length === 2, "first receipt is partial and creates two receipt items");
check(first.items.every((item) => item.lotId && item.stockMovementGroupId), "each received line creates one evidenced lot and one M4 group");
for (const item of first.items) {
  const [lot] = await db.select().from(stockProvenanceLots).where(eq(stockProvenanceLots.lotId, item.lotId));
  const [group] = await db.select().from(stockMovementGroups).where(eq(stockMovementGroups.groupId, item.stockMovementGroupId));
  check(lot.originKind === "RECEIPT" && lot.receiptId === first.receiptId && lot.lotId !== "00000000-0000-0000-0000-000000000000", `line ${item.sku} has new non-legacy receipt provenance`);
  check(group.movementType === "RECEPTION" && group.referenceType === "RECEIPT" && group.referenceId === first.receiptId && group.destinationLocationId === STORE, `line ${item.sku} movement references exact receipt and destination`);
}
for (const [sku, type, packSize, qty] of [[BOX_SKU,"Box",0,6],[PACK_SKU,"Pack",5,2]]) {
  const state = await onHand(sku, type, packSize); check(state.aggregate === qty && state.location === qty && state.lots === qty, `${sku} aggregate == location == lots after partial receipt`);
}
const beforeRetry = await counts();
const stockBeforeRetry = await Promise.all([[BOX_SKU, "Box", 0], [PACK_SKU, "Pack", 5]].map(([sku, type, packSize]) => onHand(sku, type, packSize)));
const retry = await createReceipt(firstInput); const afterRetry = await counts();
check(retry.idempotentReplay && retry.receiptId === first.receiptId, "identical receipt retry returns the same receipt");
check(JSON.stringify(beforeRetry) === JSON.stringify(afterRetry)
  && JSON.stringify(stockBeforeRetry) === JSON.stringify(await Promise.all([[BOX_SKU, "Box", 0], [PACK_SKU, "Pack", 5]].map(([sku, type, packSize]) => onHand(sku, type, packSize)))),
"retry creates zero extra receipt, lot, group, movement, allocation, or stock");

let mismatchRejected = false;
try { await createReceipt({ ...firstInput, notes: "changed payload under the same durable key" }); }
catch (error) { mismatchRejected = error.code === "idempotency_payload_mismatch"; }
check(mismatchRejected, "same receipt idempotency key with changed payload fails closed");
check(JSON.stringify(beforeRetry) === JSON.stringify(await counts()), "changed-payload retry leaves all evidence and ledger counts unchanged");

let overRejected = false;
try { await createReceipt({ ...firstInput, clientRequestId: randomUUID(), receivedAt: "2026-01-06T10:00:00Z", lines: [{ ...firstInput.lines[0], receivedQuantity: 5 }] }); }
catch (error) { overRejected = error.code === "over_receipt_blocked"; }
check(overRejected, "over-receipt above the remaining PO quantity is blocked clearly");
check(JSON.stringify(await counts()) === JSON.stringify(afterRetry)
  && JSON.stringify(stockBeforeRetry) === JSON.stringify(await Promise.all([[BOX_SKU, "Box", 0], [PACK_SKU, "Pack", 5]].map(([sku, type, packSize]) => onHand(sku, type, packSize)))),
"over-receipt leaves all evidence, ledger counts, and projections unchanged");

const second = await createReceipt({
  ...firstInput, clientRequestId: randomUUID(), receivedAt: "2026-01-07T10:00:00Z", invoiceReference: `INV-2-${run}`,
  lines: [{ ...firstInput.lines[0], receivedQuantity: 4 }, { ...firstInput.lines[1], receivedQuantity: 4 }],
});
const completed = await getPurchaseOrder(po.purchaseOrderId);
check(second.purchaseOrderStatus === "RECEIVED" && completed.status === "RECEIVED" && completed.items.every((item) => item.outstandingQuantity === 0), "second receipt completes PO-1 exactly");
const trace = await getStockTraceability({ sku: BOX_SKU, type: "Box", packSize: 0 }, { limit: 50, offset: 0 });
check(trace.lots.length === 2 && trace.lots.every((lot) => lot.supplierId === supplierA.supplierId && lot.receiptId), "M5 proves supplier -> receipt -> two lots -> explicit location");

const rollbackPo = await createPurchaseOrder({ clientRequestId: randomUUID(), supplierId: supplierA.supplierId, orderedAt: "2026-02-01T10:00:00Z", createdBy: "m8-rehearsal", lines: [
  { sku: ROLLBACK_SKU, type: "Box", packSize: 0, orderedQuantity: 1 }, { sku: ROLLBACK_SKU, type: "Loose", packSize: 0, orderedQuantity: 5 },
] });
const rbBox = rollbackPo.items.find((item) => item.type === "Box"), rbLoose = rollbackPo.items.find((item) => item.type === "Loose");
const beforeFailure = await counts(); let atomicRejected = false;
try { await createReceipt({ clientRequestId: randomUUID(), purchaseOrderId: rollbackPo.purchaseOrderId, destinationLocationId: STORE, receivedAt: "2026-02-02T10:00:00Z", author: "m8-rehearsal", lines: [
  { purchaseOrderItemId: rbBox.purchaseOrderItemId, sku: ROLLBACK_SKU, type: "Box", packSize: 0, receivedQuantity: 1 },
  { purchaseOrderItemId: rbLoose.purchaseOrderItemId, sku: ROLLBACK_SKU, type: "Loose", packSize: 0, receivedQuantity: 5 },
] }); } catch { atomicRejected = true; }
check(atomicRejected, "invalid second physical line rejects the multi-line receipt");
check(JSON.stringify(beforeFailure) === JSON.stringify(await counts()), "invalid second line leaves no receipt, lot, group, allocation, or partial stock increase");
check((await getPurchaseOrder(rollbackPo.purchaseOrderId)).status === "ORDERED", "failed receipt leaves PO status coherent");

const sale = await createManualSale({
  clientRequestId: randomUUID(), author: "m8-rehearsal", customerId: CUSTOMER, orderDate: "2026-03-01T10:00:00Z",
  lines: [{ itemType: "PRODUCT", sku: BOX_SKU, quantity: 7, regularUnitPriceXaf: 1000, stockDisposition: "CONSUME", stockType: "Box", stockPackSize: 0, sourceLocationId: STORE }],
});
const saleGroup = sale.movementGroupIds[0];
const saleAllocations = await db.select().from(stockMovementLotAllocations).where(eq(stockMovementLotAllocations.groupId, saleGroup));
check(saleAllocations.length === 2 && saleAllocations[0].lotId === first.items.find((item) => item.sku === BOX_SKU).lotId && saleAllocations[0].qtyDelta === -6 && saleAllocations[1].qtyDelta === -1,
  "M7 sale consumes oldest M8 receipt lot first, then newer lot");
const [saleHeader] = await db.select().from(stockMovementGroups).where(eq(stockMovementGroups.groupId, saleGroup));
check(saleHeader.referenceType === "ORDER" && saleHeader.referenceId === sale.orderId, "ORDER sale reference coexists with RECEIPT provenance history");
const finalState = await onHand(BOX_SKU, "Box", 0);
check(finalState.aggregate === 3 && finalState.location === 3 && finalState.lots === 3, "cross-flow preserves aggregate/location/lot reconciliation");

const raw = await mysql.createConnection("mysql://root@127.0.0.1:3399/citicigars_rehearsal");
const [[environment]] = await raw.query("SELECT VERSION() AS version, DATABASE() AS databaseName");
const [[journal]] = await raw.query("SELECT id, hash, created_at AS createdAt FROM __drizzle_migrations ORDER BY id DESC LIMIT 1");
const [[aggregateReconciliation]] = await raw.query(`
  SELECT COUNT(*) AS total,
    SUM(CASE WHEN a.on_hand_qty <> COALESCE(l.on_hand_qty, 0)
      OR a.reserved_client_qty <> COALESCE(l.reserved_client_qty, 0)
      OR a.reserved_event_qty <> COALESCE(l.reserved_event_qty, 0)
      OR a.deposit_qty <> COALESCE(l.deposit_qty, 0)
      OR a.at_event_qty <> COALESCE(l.at_event_qty, 0)
      OR a.transit_qty <> COALESCE(l.transit_qty, 0) THEN 1 ELSE 0 END) AS mismatches
  FROM stock_balances a
  LEFT JOIN (
    SELECT sku, type, pack_size,
      SUM(on_hand_qty) AS on_hand_qty, SUM(reserved_client_qty) AS reserved_client_qty,
      SUM(reserved_event_qty) AS reserved_event_qty, SUM(deposit_qty) AS deposit_qty,
      SUM(at_event_qty) AS at_event_qty, SUM(transit_qty) AS transit_qty
    FROM stock_location_balances GROUP BY sku, type, pack_size
  ) l ON l.sku = a.sku AND l.type = a.type AND l.pack_size = a.pack_size`);
const [[locationReconciliation]] = await raw.query(`
  SELECT COUNT(*) AS total,
    SUM(CASE WHEN b.on_hand_qty <> COALESCE(x.on_hand_qty, 0)
      OR b.reserved_client_qty <> COALESCE(x.reserved_client_qty, 0)
      OR b.reserved_event_qty <> COALESCE(x.reserved_event_qty, 0)
      OR b.deposit_qty <> COALESCE(x.deposit_qty, 0)
      OR b.at_event_qty <> COALESCE(x.at_event_qty, 0)
      OR b.transit_qty <> COALESCE(x.transit_qty, 0) THEN 1 ELSE 0 END) AS mismatches
  FROM stock_location_balances b
  LEFT JOIN (
    SELECT location_id, sku, type, pack_size,
      SUM(on_hand_qty) AS on_hand_qty, SUM(reserved_client_qty) AS reserved_client_qty,
      SUM(reserved_event_qty) AS reserved_event_qty, SUM(deposit_qty) AS deposit_qty,
      SUM(at_event_qty) AS at_event_qty, SUM(transit_qty) AS transit_qty
    FROM stock_lot_location_balances GROUP BY location_id, sku, type, pack_size
  ) x ON x.location_id = b.location_id AND x.sku = b.sku AND x.type = b.type AND x.pack_size = b.pack_size`);
await raw.end();
check(Number(aggregateReconciliation.mismatches) === 0,
  `global aggregate == sum(locations): ${aggregateReconciliation.total} rows, 0 mismatches`);
check(Number(locationReconciliation.mismatches) === 0,
  `global location == sum(lots): ${locationReconciliation.total} rows, 0 mismatches`);
console.log(`DB: MariaDB ${environment.version}, ${environment.databaseName}, journal id ${journal.id}, hash ${String(journal.hash).slice(0, 12)}, created_at ${journal.createdAt}`);

console.log(`=== M8 RESULT: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
