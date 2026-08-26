// Milestone 7 real-MariaDB rehearsal. Disposable local database only.
process.env.MYSQL_URL = "mysql://root@127.0.0.1:3399/citicigars_rehearsal";

import { randomUUID } from "crypto";

let pass = 0;
let fail = 0;
const ok = (message) => { pass++; console.log(`OK: ${message}`); };
const bad = (message) => { fail++; console.error(`FAIL: ${message}`); };
const check = (condition, message, detail = "") => condition ? ok(message) : bad(`${message}${detail ? ` — ${detail}` : ""}`);

const { db } = await import("../server/db.mysql.ts");
const { stockStorage } = await import("../server/storage.stock.ts");
const { createManualSale } = await import("../server/services/manual-sale.ts");
const { and, eq } = await import("drizzle-orm");
const { customers } = await import("../shared/schema.crm.ts");
const { orders, orderItems } = await import("../shared/schema.sales.ts");
const { products } = await import("../shared/schema.mysql.ts");
const {
  skus, cigarCatalog, stockBalances, stockLocations, stockLocationBalances,
  stockReceipts, stockProvenanceLots, stockReceiptItems, stockLotLocationBalances,
  stockMovementGroups, stockMovements, stockMovementLotAllocations,
} = await import("../shared/schema.stock.ts");

const runId = Date.now().toString(36).toUpperCase();
const SKU = `M7-${runId}`;
const CIGAR_ID = `M7C${runId}`.slice(0, 20);
const CUSTOMER = randomUUID();
const STORE = randomUUID();
const lots = {
  boxOld: randomUUID(), boxNew: randomUUID(), packOld: randomUUID(), packNew: randomUUID(),
};
const receipts = {
  old: randomUUID(), newer: randomUUID(),
};

async function ledgerCounts() {
  return {
    orders: (await db.select().from(orders)).length,
    items: (await db.select().from(orderItems)).length,
    groups: (await db.select().from(stockMovementGroups)).length,
    movements: (await db.select().from(stockMovements)).length,
    allocations: (await db.select().from(stockMovementLotAllocations)).length,
  };
}

async function projection(type, packSize) {
  const identity = and(eq(stockBalances.sku, SKU), eq(stockBalances.type, type), eq(stockBalances.packSize, packSize));
  const [aggregate] = await db.select().from(stockBalances).where(identity);
  const [location] = await db.select().from(stockLocationBalances).where(and(
    eq(stockLocationBalances.locationId, STORE), eq(stockLocationBalances.sku, SKU),
    eq(stockLocationBalances.type, type), eq(stockLocationBalances.packSize, packSize),
  ));
  const lotRows = await db.select().from(stockLotLocationBalances).where(and(
    eq(stockLotLocationBalances.locationId, STORE), eq(stockLotLocationBalances.sku, SKU),
    eq(stockLotLocationBalances.type, type), eq(stockLotLocationBalances.packSize, packSize),
  ));
  const lotOnHand = lotRows.reduce((sum, row) => sum + row.onHandQty, 0);
  return { aggregate, location, lotRows, lotOnHand };
}

const saleInput = (clientRequestId, packQty) => ({
  clientRequestId,
  author: "m7-local-rehearsal",
  customerId: CUSTOMER,
  orderDate: "2026-08-26T12:00:00.000Z",
  lines: [
    {
      itemType: "PRODUCT", sku: SKU, quantity: 3, regularUnitPriceXaf: 100_000,
      stockDisposition: "CONSUME", stockType: "Box", stockPackSize: 0, sourceLocationId: STORE,
    },
    {
      itemType: "PRODUCT", sku: SKU, quantity: packQty, regularUnitPriceXaf: 25_000,
      stockDisposition: "CONSUME", stockType: "Pack", stockPackSize: 5, sourceLocationId: STORE,
    },
  ],
  amountPaid: 0,
});

console.log("=== Milestone 7 CRM -> Stock disposable MariaDB rehearsal ===");
await db.insert(skus).values({ sku: SKU, kind: "CIGAR" });
await db.insert(cigarCatalog).values({ cigarId: CIGAR_ID, marque: "M7", ligne: "CRM Stock", vitole: "Test" });
await db.insert(products).values({ sku: SKU, cigarId: CIGAR_ID, marque: "M7", ligne: "CRM Stock", vitole: "Test", cigarsPerBox: 20 });
await db.insert(customers).values({ customerId: CUSTOMER, firstName: "M7", lastName: "Rehearsal", status: "PROSPECT" });
await db.insert(stockLocations).values({ locationId: STORE, code: `M7_STORE_${runId}`, name: "M7 physical store", category: "CITI_STORAGE" });
await db.insert(stockReceipts).values([
  { receiptId: receipts.old, receiptCode: `M7_OLD_${runId}`, destinationLocationId: STORE, receivedAt: new Date("2026-01-01T10:00:00Z"), author: "m7-local-rehearsal" },
  { receiptId: receipts.newer, receiptCode: `M7_NEW_${runId}`, destinationLocationId: STORE, receivedAt: new Date("2026-02-01T10:00:00Z"), author: "m7-local-rehearsal" },
]);
await db.insert(stockProvenanceLots).values([
  { lotId: lots.boxOld, lotCode: `M7_BOX_OLD_${runId}`, originKind: "RECEIPT", receiptId: receipts.old },
  { lotId: lots.boxNew, lotCode: `M7_BOX_NEW_${runId}`, originKind: "RECEIPT", receiptId: receipts.newer },
  { lotId: lots.packOld, lotCode: `M7_PACK_OLD_${runId}`, originKind: "RECEIPT", receiptId: receipts.old },
  { lotId: lots.packNew, lotCode: `M7_PACK_NEW_${runId}`, originKind: "RECEIPT", receiptId: receipts.newer },
]);
await db.insert(stockReceiptItems).values([
  { receiptItemId: randomUUID(), receiptId: receipts.old, lotId: lots.boxOld, sku: SKU, type: "Box", packSize: 0, quantity: 2 },
  { receiptItemId: randomUUID(), receiptId: receipts.newer, lotId: lots.boxNew, sku: SKU, type: "Box", packSize: 0, quantity: 2 },
  { receiptItemId: randomUUID(), receiptId: receipts.old, lotId: lots.packOld, sku: SKU, type: "Pack", packSize: 5, quantity: 2 },
  { receiptItemId: randomUUID(), receiptId: receipts.newer, lotId: lots.packNew, sku: SKU, type: "Pack", packSize: 5, quantity: 2 },
]);
for (const [lotId, type, packSize] of [
  [lots.boxOld, "Box", 0], [lots.boxNew, "Box", 0], [lots.packOld, "Pack", 5], [lots.packNew, "Pack", 5],
]) {
  await stockStorage.applyLocationMovement({
    sku: SKU, type, packSize, movementType: "RECEPTION", qty: 2,
    destinationLocationId: STORE, lotId, author: "m7-local-rehearsal",
  });
}
ok("four evidenced receipt lots created (old/new for Box and Pack)");

const requestId = randomUUID();
const created = await createManualSale(saleInput(requestId, 3));
check(created.status === "CONFIRMED" && created.movementGroupIds.length === 2, "two-line confirmed CRM sale created with two stock groups");
const savedItems = await db.select().from(orderItems).where(eq(orderItems.orderId, created.orderId));
check(savedItems.length === 2 && savedItems.every((item) => item.stockMovementGroupId), "each order item persists its exact stock group link");

for (const item of savedItems) {
  const [group] = await db.select().from(stockMovementGroups).where(eq(stockMovementGroups.groupId, item.stockMovementGroupId));
  check(group.movementType === "VENTE" && group.referenceType === "ORDER" && group.referenceId === created.orderId && group.referenceLabel === item.orderItemId,
    `VENTE group references ORDER and exact line ${item.orderItemId}`);
  check(group.sourceLocationId === STORE && group.destinationLocationId == null, `VENTE source metadata is the selected physical location for ${item.orderItemId}`);
  const allocations = await db.select().from(stockMovementLotAllocations).where(eq(stockMovementLotAllocations.groupId, item.stockMovementGroupId));
  const expected = item.stockType === "Box" ? [lots.boxOld, lots.boxNew] : [lots.packOld, lots.packNew];
  check(allocations.length === 2 && allocations[0].lotId === expected[0] && allocations[1].lotId === expected[1],
    `deterministic receipt FIFO consumed old then new ${item.stockType} lot`);
}

for (const [type, packSize] of [["Box", 0], ["Pack", 5]]) {
  const state = await projection(type, packSize);
  check(state.aggregate.onHandQty === 1 && state.location.onHandQty === 1 && state.lotOnHand === 1,
    `aggregate == selected location == sum(lots) after ${type} sale`);
}

const countsAfterFirst = await ledgerCounts();
const retry = await createManualSale(saleInput(requestId, 3));
const countsAfterRetry = await ledgerCounts();
check(retry.idempotentReplay && retry.orderId === created.orderId, "same clientRequestId returns the same order as an idempotent replay");
check(JSON.stringify(countsAfterRetry) === JSON.stringify(countsAfterFirst), "retry creates no order, movement, allocation, or decrement");

const beforeFailure = await ledgerCounts();
const beforeBox = await projection("Box", 0);
const beforePack = await projection("Pack", 5);
const failingRequestId = randomUUID();
let rejected = false;
try {
  await createManualSale(saleInput(failingRequestId, 99));
} catch (error) {
  rejected = true;
  ok(`insufficient second line rejected (${error.code || error.message})`);
}
if (!rejected) bad("insufficient second line should reject");
const afterFailure = await ledgerCounts();
const afterBox = await projection("Box", 0);
const afterPack = await projection("Pack", 5);
const [orphanOrder] = await db.select().from(orders).where(and(
  eq(orders.sourceSystem, "crm_manual_sale_stock_v1"), eq(orders.sourceRecordId, failingRequestId),
));
check(!orphanOrder, "failed multi-line sale leaves no CRM order");
check(JSON.stringify(afterFailure) === JSON.stringify(beforeFailure), "failed second line rolls back first-line groups, movements, and allocations");
check(afterBox.aggregate.onHandQty === beforeBox.aggregate.onHandQty && afterPack.aggregate.onHandQty === beforePack.aggregate.onHandQty,
  "failed second line leaves both aggregate projections unchanged");
check(afterBox.location.onHandQty === beforeBox.location.onHandQty && afterPack.location.onHandQty === beforePack.location.onHandQty &&
  afterBox.lotOnHand === beforeBox.lotOnHand && afterPack.lotOnHand === beforePack.lotOnHand,
  "failed second line leaves location and lot projections unchanged");

console.log(`=== M7 RESULT: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
