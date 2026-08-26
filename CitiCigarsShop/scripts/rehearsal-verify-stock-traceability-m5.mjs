// Phase 2 / Milestone 5 read API rehearsal. Disposable local MariaDB only.
process.env.MYSQL_URL = "mysql://root@127.0.0.1:3399/citicigars_rehearsal";
process.env.CMS_ADMIN_PASSWORD = "m5-disposable-admin";

import { randomUUID } from "crypto";

let pass = 0;
let fail = 0;
function ok(message) { pass++; console.log("OK: " + message); }
function bad(message) { fail++; console.error("FAIL: " + message); }
function check(condition, message, details) { condition ? ok(message) : bad(`${message}: ${JSON.stringify(details)}`); }

const { default: express } = await import("express");
const { createServer } = await import("http");
const { db } = await import("../server/db.mysql.ts");
const { stockStorage } = await import("../server/storage.stock.ts");
const { registerStockTraceabilityRoutes } = await import("../server/routes.stock-traceability.ts");
const { and, count, eq } = await import("drizzle-orm");
const {
  LEGACY_UNKNOWN_LOCATION_CODE,
  skus,
  cigarCatalog,
  stockLocations,
  stockSuppliers,
  stockReceipts,
  stockProvenanceLots,
  stockReceiptItems,
  stockMovementGroups,
  stockMovements,
  stockMovementLotAllocations,
} = await import("../shared/schema.stock.ts");
const { products } = await import("../shared/schema.mysql.ts");

const runId = Date.now().toString(36).toUpperCase();
const SKU = `M5-${runId}`;
const ZERO_SKU = `M5Z-${runId}`;
const CIGAR_ID = `M5C${runId}`.slice(0, 20);
const STORE = randomUUID();
const PARTNER = randomUUID();
const EVENT = randomUUID();
const SUPPLIER = randomUUID();
const RECEIPT_A = randomUUID();
const RECEIPT_B = randomUUID();
const LOT_A = randomUUID();
const LOT_B = randomUUID();

await db.insert(skus).values([{ sku: SKU, kind: "CIGAR" }, { sku: ZERO_SKU, kind: "ACCESSORY" }]);
await db.insert(cigarCatalog).values({ cigarId: CIGAR_ID, marque: "M5", ligne: "Operational Read", vitole: "Trace" });
await db.insert(products).values({ sku: SKU, cigarId: CIGAR_ID, marque: "M5", ligne: "Operational Read", vitole: "Trace" });
await db.insert(stockLocations).values([
  { locationId: STORE, code: `M5_STORE_${runId}`, name: "M5 store", category: "CITI_STORAGE" },
  { locationId: PARTNER, code: `M5_PARTNER_${runId}`, name: "M5 partner", category: "PARTNER" },
  { locationId: EVENT, code: `M5_EVENT_${runId}`, name: "M5 event", category: "EVENT" },
]);
await db.insert(stockSuppliers).values({ supplierId: SUPPLIER, code: `M5_SUP_${runId}`, name: "M5 evidenced supplier" });
await db.insert(stockReceipts).values([
  { receiptId: RECEIPT_A, receiptCode: `M5_REC_A_${runId}`, supplierId: SUPPLIER, destinationLocationId: STORE, receivedAt: new Date("2026-04-01T10:00:00Z"), author: "m5-test" },
  { receiptId: RECEIPT_B, receiptCode: `M5_REC_B_${runId}`, supplierId: SUPPLIER, destinationLocationId: STORE, receivedAt: new Date("2026-05-01T10:00:00Z"), author: "m5-test" },
]);
await db.insert(stockProvenanceLots).values([
  { lotId: LOT_A, lotCode: `M5_LOT_A_${runId}`, originKind: "RECEIPT", receiptId: RECEIPT_A },
  { lotId: LOT_B, lotCode: `M5_LOT_B_${runId}`, originKind: "RECEIPT", receiptId: RECEIPT_B },
]);
await db.insert(stockReceiptItems).values([
  { receiptItemId: randomUUID(), receiptId: RECEIPT_A, lotId: LOT_A, sku: SKU, type: "Box", packSize: 0, quantity: 5 },
  { receiptItemId: randomUUID(), receiptId: RECEIPT_B, lotId: LOT_B, sku: SKU, type: "Box", packSize: 0, quantity: 5 },
]);

await stockStorage.applyMovement({ sku: SKU, type: "Box", packSize: 0, movementType: "RECEPTION", qty: 1, author: "m5-legacy" });
await stockStorage.applyLocationMovement({ sku: SKU, type: "Box", packSize: 0, movementType: "RECEPTION", qty: 5, destinationLocationId: STORE, lotId: LOT_A, author: "m5-test", movementDate: new Date("2026-04-01T10:00:00Z") });
await stockStorage.applyLocationMovement({ sku: SKU, type: "Box", packSize: 0, movementType: "RECEPTION", qty: 5, destinationLocationId: STORE, lotId: LOT_B, author: "m5-test", movementDate: new Date("2026-05-01T10:00:00Z") });
const reservation = await stockStorage.applyLocationMovement({ sku: SKU, type: "Box", packSize: 0, movementType: "RESERVATION_CLIENT", qty: 2, sourceLocationId: STORE, author: "m5-test" });
const sale = await stockStorage.applyLocationMovement({ sku: SKU, type: "Box", packSize: 0, movementType: "VENTE", qty: 3, sourceLocationId: STORE, author: "m5-test", referenceType: "ORDER", referenceId: `M5-ORDER-${runId}` });
await stockStorage.applyLocationMovement({ sku: SKU, type: "Box", packSize: 0, movementType: "MISE_EN_DEPOT", qty: 1, sourceLocationId: STORE, destinationLocationId: PARTNER, author: "m5-test" });
await stockStorage.applyLocationMovement({ sku: SKU, type: "Box", packSize: 0, movementType: "RETOUR_DE_DEPOT", qty: 1, sourceLocationId: PARTNER, destinationLocationId: STORE, author: "m5-test" });
await stockStorage.applyLocationMovement({ sku: SKU, type: "Box", packSize: 0, movementType: "RESERVATION_EVENEMENT", qty: 1, sourceLocationId: STORE, author: "m5-test" });
await stockStorage.applyLocationMovement({ sku: SKU, type: "Box", packSize: 0, movementType: "SORTIE_EVENEMENT", qty: 1, sourceLocationId: STORE, destinationLocationId: EVENT, author: "m5-test" });
await stockStorage.applyLocationMovement({ sku: SKU, type: "Box", packSize: 0, movementType: "RETOUR_EVENEMENT", qty: 1, sourceLocationId: EVENT, destinationLocationId: STORE, author: "m5-test" });
await stockStorage.applyLocationMovement({ sku: SKU, type: "Box", packSize: 0, movementType: "CORRECTION_INVENTAIRE", qty: 6, sourceLocationId: STORE, author: "m5-test" });

async function ledgerCounts() {
  const [[groups], [movements], [allocations]] = await Promise.all([
    db.select({ value: count() }).from(stockMovementGroups),
    db.select({ value: count() }).from(stockMovements),
    db.select({ value: count() }).from(stockMovementLotAllocations),
  ]);
  return { groups: Number(groups.value), movements: Number(movements.value), allocations: Number(allocations.value) };
}

const app = express();
registerStockTraceabilityRoutes(app);
const server = createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const base = `http://127.0.0.1:${address.port}`;
const token = Buffer.from(process.env.CMS_ADMIN_PASSWORD).toString("base64");
const authenticated = (path) => fetch(path.startsWith("http") ? path : base + path, { headers: { "x-cms-token": token } });
const encodedSku = encodeURIComponent(SKU);
const beforeReads = await ledgerCounts();

const unauthorized = await fetch(`${base}/api/admin/stock/${encodedSku}`);
check(unauthorized.status === 401, "operational traceability is protected by existing admin auth", { status: unauthorized.status });

const unknown = await authenticated("/api/admin/stock/DOES-NOT-EXIST");
check(unknown.status === 404 && (await unknown.json()).error === "sku_not_found", "unknown SKU returns a stable 404", { status: unknown.status });

const zeroSummaryResponse = await authenticated(`${base}/api/admin/stock/${encodeURIComponent(ZERO_SKU)}`);
const zeroSummary = await zeroSummaryResponse.json();
check(zeroSummaryResponse.status === 200 && zeroSummary.positions.length === 0, "known SKU with no stock returns an empty summary", zeroSummary);
const zeroExactResponse = await authenticated(`${base}/api/admin/stock/${encodeURIComponent(ZERO_SKU)}?type=Accessory`);
const zeroExact = await zeroExactResponse.json();
check(zeroExactResponse.status === 200 && zeroExact.positions[0]?.hasPosition === false && zeroExact.positions[0]?.isZero === true, "valid absent identity returns an explicit zero position", zeroExact);

const invalidType = await authenticated(`${base}/api/admin/stock/${encodedSku}?type=Bogus`);
const invalidPack = await authenticated(`${base}/api/admin/stock/${encodedSku}?type=Pack&packSize=0`);
check(invalidType.status === 400 && invalidPack.status === 400, "invalid type and pack sentinel return 400 instead of 500", { invalidType: invalidType.status, invalidPack: invalidPack.status });

const summaryResponse = await authenticated(`${base}/api/admin/stock/${encodedSku}?type=Box`);
const summary = await summaryResponse.json();
check(summaryResponse.status === 200 && summary.positions.length === 1 && summary.positions[0].buckets.onHand === 7 && summary.positions[0].buckets.reservedClient === 2 && summary.positions[0].availableNow === 5, "summary exposes aggregate lifecycle buckets and derived availability", summary);

const traceResponse = await authenticated(`${base}/api/admin/stock/${encodedSku}/traceability?type=Box&limit=100`);
const trace = await traceResponse.json();
check(traceResponse.status === 200 && trace.reconciliation.status === "RECONCILED" && trace.reconciliation.aggregateEqualsLocations && trace.reconciliation.locationsEqualLots, "trace read enforces aggregate/location/lot reconciliation", trace.reconciliation);
check(trace.locations.some((row) => row.code === LEGACY_UNKNOWN_LOCATION_CODE) && trace.locations.some((row) => row.locationId === STORE), "mixed evidenced and LEGACY_UNKNOWN physical positions remain explicit", trace.locations);
check(trace.lots.some((row) => row.originKind === "LEGACY_UNKNOWN") && trace.lots.some((row) => row.originKind === "RECEIPT" && row.supplierId === SUPPLIER), "mixed unknown and evidenced provenance is returned without inference", trace.lots);
check(trace.lots.filter((row) => row.originKind === "RECEIPT").map((row) => row.lotId).join(",") === [LOT_A, LOT_B].join(","), "current evidenced lots use deterministic receipt chronology", trace.lots);
check(trace.history.total === 11 && trace.history.operations.length === 11, "chronological history returns every controlled business operation", trace.history);
check(trace.history.operations.every((operation) => operation.details.length > 0 && operation.details.every((detail) => detail.movementType === operation.movementType)), "every movement group is backed by matching immutable detail rows", trace.history.operations);
check(trace.history.operations.every((operation) => operation.allocationConsistency.status === "RECONCILED"), "lot allocations explain every controlled movement delta", trace.history.operations.map((operation) => ({ groupId: operation.groupId, status: operation.allocationConsistency.status })));

const pagedResponse = await authenticated(`${base}/api/admin/stock/${encodedSku}/traceability?type=Box&limit=2&offset=1`);
const paged = await pagedResponse.json();
check(pagedResponse.status === 200 && paged.history.limit === 2 && paged.history.offset === 1 && paged.history.total === 11 && paged.history.operations.length === 2, "history pagination is bounded and reports total/limit/offset", paged.history);
const excessiveLimit = await authenticated(`${base}/api/admin/stock/${encodedSku}/traceability?type=Box&limit=101`);
check(excessiveLimit.status === 400, "history limit above the documented maximum is rejected", { status: excessiveLimit.status });

const saleTraceResponse = await authenticated(`${base}/api/admin/stock/movements/${sale.groupId}`);
const saleTrace = await saleTraceResponse.json();
const saleNegativeLots = saleTrace.lotAllocations.filter((row) => row.balanceField === "onHand" && row.qtyDelta < 0);
check(saleTraceResponse.status === 200 && saleTrace.groupId === sale.groupId && saleTrace.referenceId === `M5-ORDER-${runId}` && saleTrace.allocationConsistency.status === "RECONCILED", "single movement endpoint exposes immutable group, detail, reference, and reconciled allocations", saleTrace);
check(saleNegativeLots.length === 1 && saleNegativeLots[0].lotId === LOT_A && saleNegativeLots[0].qtyDelta === -3, "sale allocation output preserves deterministic FIFO ledger order", saleNegativeLots);

const reservationTrace = await (await authenticated(`${base}/api/admin/stock/movements/${reservation.groupId}`)).json();
check(reservationTrace.sourceLocationId === STORE && reservationTrace.destinationLocationId === STORE, "reservation history records locality without fake relocation", reservationTrace);
const missingGroup = await authenticated(`${base}/api/admin/stock/movements/${randomUUID()}`);
check(missingGroup.status === 404, "unknown movement group returns a stable 404", { status: missingGroup.status });

const afterReads = await ledgerCounts();
check(JSON.stringify(beforeReads) === JSON.stringify(afterReads), "all M5 API calls are read-only and preserve append-only ledger counts", { beforeReads, afterReads });

await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
await db.$client.end();
console.log(`=== MILESTONE 5 RESULT: ${pass} OK, ${fail} FAIL ===`);
process.exitCode = fail > 0 ? 1 : 0;
