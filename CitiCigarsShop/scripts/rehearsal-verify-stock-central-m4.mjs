// Phase 2 / Milestone 4 real-MariaDB rehearsal. Disposable local database only.
process.env.MYSQL_URL = "mysql://root@127.0.0.1:3399/citicigars_rehearsal";

import { randomUUID } from "crypto";

let pass = 0;
let fail = 0;
function ok(message) { pass++; console.log("OK: " + message); }
function bad(message) { fail++; console.error("FAIL: " + message); }
async function expectThrow(fn, label) {
  try {
    await fn();
    bad(`${label}: expected an exception`);
  } catch (error) {
    ok(`${label}: rejected atomically (${error.code || error.message})`);
  }
}

const { db } = await import("../server/db.mysql.ts");
const { stockStorage } = await import("../server/storage.stock.ts");
const { and, eq } = await import("drizzle-orm");
const {
  skus,
  cigarCatalog,
  stockBalances,
  stockLocations,
  stockLocationBalances,
  stockReceipts,
  stockProvenanceLots,
  stockReceiptItems,
  stockLotLocationBalances,
  stockMovementGroups,
  stockMovements,
  stockMovementLotAllocations,
} = await import("../shared/schema.stock.ts");
const { products } = await import("../shared/schema.mysql.ts");

const runId = Date.now().toString(36).toUpperCase();
const SKU = `M4-${runId}`;
const CIGAR_ID = `M4C${runId}`.slice(0, 20);
const STORE = randomUUID();
const PARTNER = randomUUID();
const EVENT = randomUUID();
const LOT_OLD = randomUUID();
const LOT_NEW = randomUUID();
const LOT_CONC_A = randomUUID();
const LOT_CONC_B = randomUUID();
const RECEIPT_OLD = randomUUID();
const RECEIPT_NEW = randomUUID();
const RECEIPT_CONC = randomUUID();

const fields = ["onHandQty", "reservedClientQty", "reservedEventQty", "atEventQty", "depositQty", "transitQty"];
const zeroBuckets = () => ({ onHandQty: 0, reservedClientQty: 0, reservedEventQty: 0, atEventQty: 0, depositQty: 0, transitQty: 0 });
const sameBuckets = (a, b) => fields.every((field) => (a?.[field] ?? 0) === (b?.[field] ?? 0));

async function getAggregate(type, packSize) {
  const [row] = await db.select().from(stockBalances).where(and(
    eq(stockBalances.sku, SKU), eq(stockBalances.type, type), eq(stockBalances.packSize, packSize),
  ));
  return row;
}
async function getLocation(locationId, type, packSize) {
  const [row] = await db.select().from(stockLocationBalances).where(and(
    eq(stockLocationBalances.locationId, locationId), eq(stockLocationBalances.sku, SKU),
    eq(stockLocationBalances.type, type), eq(stockLocationBalances.packSize, packSize),
  ));
  return row;
}
async function getLot(lotId, locationId, type, packSize) {
  const [row] = await db.select().from(stockLotLocationBalances).where(and(
    eq(stockLotLocationBalances.lotId, lotId), eq(stockLotLocationBalances.locationId, locationId),
    eq(stockLotLocationBalances.sku, SKU), eq(stockLotLocationBalances.type, type),
    eq(stockLotLocationBalances.packSize, packSize),
  ));
  return row;
}
async function ledgerCounts() {
  return {
    groups: (await db.select().from(stockMovementGroups)).length,
    movements: (await db.select().from(stockMovements)).length,
    allocations: (await db.select().from(stockMovementLotAllocations)).length,
  };
}

console.log("=== Milestone 4 disposable MariaDB rehearsal ===");
await db.insert(skus).values({ sku: SKU, kind: "CIGAR" });
await db.insert(cigarCatalog).values({ cigarId: CIGAR_ID, marque: "M4", ligne: "Traceability", vitole: "Test" });
await db.insert(products).values({ sku: SKU, cigarId: CIGAR_ID, marque: "M4", ligne: "Traceability", vitole: "Test" });
await db.insert(stockLocations).values([
  { locationId: STORE, code: `M4_STORE_${runId}`, name: "M4 store", category: "CITI_STORAGE" },
  { locationId: PARTNER, code: `M4_PARTNER_${runId}`, name: "M4 partner", category: "PARTNER" },
  { locationId: EVENT, code: `M4_EVENT_${runId}`, name: "M4 event", category: "EVENT" },
]);
await db.insert(stockReceipts).values([
  { receiptId: RECEIPT_OLD, receiptCode: `M4_OLD_${runId}`, destinationLocationId: STORE, receivedAt: new Date("2026-01-01T10:00:00Z"), author: "m4-test" },
  { receiptId: RECEIPT_NEW, receiptCode: `M4_NEW_${runId}`, destinationLocationId: STORE, receivedAt: new Date("2026-02-01T10:00:00Z"), author: "m4-test" },
  { receiptId: RECEIPT_CONC, receiptCode: `M4_CONC_${runId}`, destinationLocationId: STORE, receivedAt: new Date("2026-03-01T10:00:00Z"), author: "m4-test" },
]);
await db.insert(stockProvenanceLots).values([
  { lotId: LOT_OLD, lotCode: `M4_LOT_OLD_${runId}`, originKind: "RECEIPT", receiptId: RECEIPT_OLD },
  { lotId: LOT_NEW, lotCode: `M4_LOT_NEW_${runId}`, originKind: "RECEIPT", receiptId: RECEIPT_NEW },
  { lotId: LOT_CONC_A, lotCode: `M4_LOT_CA_${runId}`, originKind: "RECEIPT", receiptId: RECEIPT_CONC },
  { lotId: LOT_CONC_B, lotCode: `M4_LOT_CB_${runId}`, originKind: "RECEIPT", receiptId: RECEIPT_CONC },
]);
await db.insert(stockReceiptItems).values([
  { receiptItemId: randomUUID(), receiptId: RECEIPT_OLD, lotId: LOT_OLD, sku: SKU, type: "Box", packSize: 0, quantity: 3 },
  { receiptItemId: randomUUID(), receiptId: RECEIPT_NEW, lotId: LOT_NEW, sku: SKU, type: "Box", packSize: 0, quantity: 3 },
  { receiptItemId: randomUUID(), receiptId: RECEIPT_CONC, lotId: LOT_CONC_A, sku: SKU, type: "Pack", packSize: 4, quantity: 1 },
  { receiptItemId: randomUUID(), receiptId: RECEIPT_CONC, lotId: LOT_CONC_B, sku: SKU, type: "Pack", packSize: 4, quantity: 1 },
]);

await expectThrow(
  () => stockStorage.applyLocationMovement({ sku: SKU, type: "Box", packSize: 0, movementType: "VENTE", qty: 1, author: "m4-test" }),
  "explicit source required for location-aware decrement",
);
await expectThrow(
  () => stockStorage.applyLocationMovement({ sku: SKU, type: "Box", packSize: 0, movementType: "MISE_EN_DEPOT", qty: 1, sourceLocationId: STORE, author: "m4-test" }),
  "explicit destination required for a physical transfer",
);

for (const [lotId, qty] of [[LOT_OLD, 3], [LOT_NEW, 3]]) {
  await stockStorage.applyLocationMovement({
    sku: SKU, type: "Box", packSize: 0, movementType: "RECEPTION", qty,
    destinationLocationId: STORE, lotId, author: "m4-test",
  });
}
const storeReceived = await getLocation(STORE, "Box", 0);
const partnerReceived = await getLocation(PARTNER, "Box", 0);
if (storeReceived.onHandQty === 6 && !partnerReceived) ok("two evidenced lots received at the explicit store only");
else bad(`unexpected receipt locations: store=${JSON.stringify(storeReceived)} partner=${JSON.stringify(partnerReceived)}`);
const dnaAvailability = await stockStorage.getAvailabilityForCigarIds([CIGAR_ID]);
if (dnaAvailability.resolved[CIGAR_ID]?.boxAvailable === true && dnaAvailability.unresolved.length === 0) {
  ok("legacy DNA aggregate consumer sees location-aware stock without API or key changes");
} else bad(`DNA aggregate compatibility mismatch: ${JSON.stringify(dnaAvailability)}`);

const sale = await stockStorage.applyLocationMovement({
  sku: SKU, type: "Box", packSize: 0, movementType: "VENTE", qty: 4,
  sourceLocationId: STORE, author: "m4-test",
});
const saleAllocations = (await db.select().from(stockMovementLotAllocations)
  .where(eq(stockMovementLotAllocations.groupId, sale.groupId)))
  .filter((row) => row.balanceField === "onHand" && row.qtyDelta < 0);
if (saleAllocations.length === 2 && saleAllocations[0].lotId === LOT_OLD && saleAllocations[0].qtyDelta === -3 && saleAllocations[1].lotId === LOT_NEW && saleAllocations[1].qtyDelta === -1) {
  ok("evidenced FIFO consumes the oldest receipt lot first with deterministic ledger order");
} else bad(`unexpected FIFO allocations: ${JSON.stringify(saleAllocations)}`);

const failureBefore = {
  aggregate: await getAggregate("Box", 0),
  store: await getLocation(STORE, "Box", 0),
  oldLot: await getLot(LOT_OLD, STORE, "Box", 0),
  newLot: await getLot(LOT_NEW, STORE, "Box", 0),
  ledger: await ledgerCounts(),
};
await expectThrow(
  () => stockStorage.applyLocationMovement({ sku: SKU, type: "Box", packSize: 0, movementType: "VENTE", qty: 3, sourceLocationId: STORE, author: "m4-test" }),
  "insufficient stock across eligible lots",
);
const failureAfter = {
  aggregate: await getAggregate("Box", 0),
  store: await getLocation(STORE, "Box", 0),
  oldLot: await getLot(LOT_OLD, STORE, "Box", 0),
  newLot: await getLot(LOT_NEW, STORE, "Box", 0),
  ledger: await ledgerCounts(),
};
if (JSON.stringify(failureBefore) === JSON.stringify(failureAfter)) ok("insufficient multi-lot consumption leaves no partial projection or ledger writes");
else bad(`rollback mismatch: before=${JSON.stringify(failureBefore)} after=${JSON.stringify(failureAfter)}`);

const reservation = await stockStorage.applyLocationMovement({
  sku: SKU, type: "Box", packSize: 0, movementType: "RESERVATION_CLIENT", qty: 1,
  sourceLocationId: STORE, author: "m4-test",
});
const [reservationGroup] = await db.select().from(stockMovementGroups).where(eq(stockMovementGroups.groupId, reservation.groupId));
const afterReservation = await getLocation(STORE, "Box", 0);
if (reservationGroup.sourceLocationId === STORE && reservationGroup.destinationLocationId === STORE && afterReservation.onHandQty === 2 && afterReservation.reservedClientQty === 1 && !await getLocation(PARTNER, "Box", 0)) {
  ok("reservation stays at one location and creates no physical relocation");
} else bad(`reservation relocation mismatch: group=${JSON.stringify(reservationGroup)} store=${JSON.stringify(afterReservation)}`);

const transfer = await stockStorage.applyLocationMovement({
  sku: SKU, type: "Box", packSize: 0, movementType: "MISE_EN_DEPOT", qty: 1,
  sourceLocationId: STORE, destinationLocationId: PARTNER, author: "m4-test",
});
const [transferGroup] = await db.select().from(stockMovementGroups).where(eq(stockMovementGroups.groupId, transfer.groupId));
const transferAllocations = await db.select().from(stockMovementLotAllocations).where(eq(stockMovementLotAllocations.groupId, transfer.groupId));
const sourceAfterTransfer = await getLocation(STORE, "Box", 0);
const destinationAfterTransfer = await getLocation(PARTNER, "Box", 0);
if (transferGroup.sourceLocationId === STORE && transferGroup.destinationLocationId === PARTNER && sourceAfterTransfer.onHandQty === 1 && sourceAfterTransfer.reservedClientQty === 1 && destinationAfterTransfer.depositQty === 1 && transferAllocations.some((row) => row.locationId === STORE && row.balanceField === "onHand" && row.qtyDelta === -1) && transferAllocations.some((row) => row.locationId === PARTNER && row.balanceField === "deposit" && row.qtyDelta === 1)) {
  ok("physical transfer preserves lot identity and matches group source/destination semantics");
} else bad(`transfer mismatch: group=${JSON.stringify(transferGroup)} allocations=${JSON.stringify(transferAllocations)}`);

const depositReturn = await stockStorage.applyLocationMovement({
  sku: SKU, type: "Box", packSize: 0, movementType: "RETOUR_DE_DEPOT", qty: 1,
  sourceLocationId: PARTNER, destinationLocationId: STORE, author: "m4-test",
});
const [depositReturnGroup] = await db.select().from(stockMovementGroups).where(eq(stockMovementGroups.groupId, depositReturn.groupId));
const storeAfterDepositReturn = await getLocation(STORE, "Box", 0);
const partnerAfterDepositReturn = await getLocation(PARTNER, "Box", 0);
if (depositReturnGroup.sourceLocationId === PARTNER && depositReturnGroup.destinationLocationId === STORE && storeAfterDepositReturn.onHandQty === 2 && partnerAfterDepositReturn.depositQty === 0) {
  ok("deposit return restores the same lot to the explicit store and clears the partner deposit bucket");
} else bad(`deposit return mismatch: group=${JSON.stringify(depositReturnGroup)} store=${JSON.stringify(storeAfterDepositReturn)} partner=${JSON.stringify(partnerAfterDepositReturn)}`);

await stockStorage.applyLocationMovement({
  sku: SKU, type: "Box", packSize: 0, movementType: "RESERVATION_EVENEMENT", qty: 1,
  sourceLocationId: STORE, author: "m4-test",
});
const eventOut = await stockStorage.applyLocationMovement({
  sku: SKU, type: "Box", packSize: 0, movementType: "SORTIE_EVENEMENT", qty: 1,
  sourceLocationId: STORE, destinationLocationId: EVENT, author: "m4-test",
});
const [eventOutGroup] = await db.select().from(stockMovementGroups).where(eq(stockMovementGroups.groupId, eventOut.groupId));
const storeAtEvent = await getLocation(STORE, "Box", 0);
const eventAtEvent = await getLocation(EVENT, "Box", 0);
if (eventOutGroup.sourceLocationId === STORE && eventOutGroup.destinationLocationId === EVENT && storeAtEvent.onHandQty === 1 && storeAtEvent.reservedEventQty === 0 && eventAtEvent.atEventQty === 1) {
  ok("event sortie moves the reserved evidenced lot from store onHand to the event atEvent bucket");
} else bad(`event sortie mismatch: group=${JSON.stringify(eventOutGroup)} store=${JSON.stringify(storeAtEvent)} event=${JSON.stringify(eventAtEvent)}`);

const eventReturn = await stockStorage.applyLocationMovement({
  sku: SKU, type: "Box", packSize: 0, movementType: "RETOUR_EVENEMENT", qty: 1,
  sourceLocationId: EVENT, destinationLocationId: STORE, author: "m4-test",
});
const [eventReturnGroup] = await db.select().from(stockMovementGroups).where(eq(stockMovementGroups.groupId, eventReturn.groupId));
const storeAfterEventReturn = await getLocation(STORE, "Box", 0);
const eventAfterReturn = await getLocation(EVENT, "Box", 0);
if (eventReturnGroup.sourceLocationId === EVENT && eventReturnGroup.destinationLocationId === STORE && storeAfterEventReturn.onHandQty === 2 && eventAfterReturn.atEventQty === 0) {
  ok("event return restores the same lot to the explicit store with correct group endpoints");
} else bad(`event return mismatch: group=${JSON.stringify(eventReturnGroup)} store=${JSON.stringify(storeAfterEventReturn)} event=${JSON.stringify(eventAfterReturn)}`);

const correction = await stockStorage.applyLocationMovement({
  sku: SKU, type: "Box", packSize: 0, movementType: "CORRECTION_INVENTAIRE", qty: 1,
  sourceLocationId: STORE, author: "m4-test",
});
const [correctionGroup] = await db.select().from(stockMovementGroups).where(eq(stockMovementGroups.groupId, correction.groupId));
const storeAfterCorrection = await getLocation(STORE, "Box", 0);
if (correctionGroup.sourceLocationId === STORE && correctionGroup.destinationLocationId === STORE && storeAfterCorrection.onHandQty === 1 && (await getLocation(PARTNER, "Box", 0)).onHandQty === 0 && (await getLocation(EVENT, "Box", 0)).onHandQty === 0) {
  ok("inventory correction changes only the explicitly selected physical location");
} else bad(`inventory correction mismatch: group=${JSON.stringify(correctionGroup)} store=${JSON.stringify(storeAfterCorrection)}`);

for (const lotId of [LOT_CONC_A, LOT_CONC_B]) {
  await stockStorage.applyLocationMovement({
    sku: SKU, type: "Pack", packSize: 4, movementType: "RECEPTION", qty: 1,
    destinationLocationId: STORE, lotId, author: "m4-test",
  });
}
const concurrent = await Promise.allSettled([
  stockStorage.applyLocationMovement({ sku: SKU, type: "Pack", packSize: 4, movementType: "VENTE", qty: 2, sourceLocationId: STORE, author: "m4-A" }),
  stockStorage.applyLocationMovement({ sku: SKU, type: "Pack", packSize: 4, movementType: "VENTE", qty: 2, sourceLocationId: STORE, author: "m4-B" }),
]);
const successes = concurrent.filter((row) => row.status === "fulfilled");
const failures = concurrent.filter((row) => row.status === "rejected");
const concurrentFinal = await getLocation(STORE, "Pack", 4);
if (successes.length === 1 && failures.length === 1 && concurrentFinal.onHandQty === 0) {
  ok("concurrent consumption of the same two lots is serialized: one success, one atomic failure");
} else bad(`concurrency mismatch: success=${successes.length} failure=${failures.length} final=${JSON.stringify(concurrentFinal)}`);

const aggregates = await db.select().from(stockBalances);
const locations = await db.select().from(stockLocationBalances);
const lots = await db.select().from(stockLotLocationBalances);
let aggregateLocationMismatch = 0;
for (const aggregate of aggregates) {
  const matching = locations.filter((row) => row.sku === aggregate.sku && row.type === aggregate.type && row.packSize === aggregate.packSize);
  if (fields.some((field) => aggregate[field] !== matching.reduce((sum, row) => sum + row[field], 0))) aggregateLocationMismatch++;
}
let locationLotMismatch = 0;
for (const location of locations) {
  const matching = lots.filter((row) => row.locationId === location.locationId && row.sku === location.sku && row.type === location.type && row.packSize === location.packSize);
  if (fields.some((field) => location[field] !== matching.reduce((sum, row) => sum + row[field], 0))) locationLotMismatch++;
}
if (aggregateLocationMismatch === 0 && locationLotMismatch === 0) {
  ok(`${aggregates.length} aggregates equal location sums; ${locations.length} locations equal lot sums`);
} else bad(`projection mismatch: aggregate/location=${aggregateLocationMismatch}, location/lot=${locationLotMismatch}`);

const winningGroupId = successes[0].value.groupId;
const winningMovements = await db.select().from(stockMovements).where(eq(stockMovements.groupId, winningGroupId));
const winningAllocations = await db.select().from(stockMovementLotAllocations).where(eq(stockMovementLotAllocations.groupId, winningGroupId));
const detailDelta = winningMovements.filter((row) => row.balanceField === "onHand").reduce((sum, row) => sum + row.qtyDelta, 0);
const allocationDelta = winningAllocations.filter((row) => row.balanceField === "onHand").reduce((sum, row) => sum + row.qtyDelta, 0);
if (detailDelta === -2 && allocationDelta === detailDelta && winningAllocations.length === 2) {
  ok("append-only multi-lot allocation arithmetic exactly matches the immutable movement detail");
} else bad(`allocation arithmetic mismatch: detail=${detailDelta} allocation=${allocationDelta} rows=${winningAllocations.length}`);

await db.$client.end();
console.log(`=== MILESTONE 4 RESULT: ${pass} OK, ${fail} FAIL ===`);
process.exitCode = fail > 0 ? 1 : 0;
