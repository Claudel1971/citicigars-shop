// Phase 2 / Milestone 6 operational admin rehearsal. Disposable local MariaDB only.
process.env.MYSQL_URL = "mysql://root@127.0.0.1:3399/citicigars_rehearsal";
process.env.CMS_ADMIN_PASSWORD = "m6-disposable-admin";

import { randomUUID } from "crypto";

let pass = 0;
let fail = 0;
function ok(message) { pass++; console.log("OK: " + message); }
function bad(message, details) { fail++; console.error(`FAIL: ${message}: ${JSON.stringify(details)}`); }
function check(condition, message, details) { condition ? ok(message) : bad(message, details); }

const { default: express } = await import("express");
const { createServer } = await import("http");
const { db } = await import("../server/db.mysql.ts");
const { registerStockAdminRoutes } = await import("../server/routes.stock-admin.ts");
const { registerStockTraceabilityRoutes } = await import("../server/routes.stock-traceability.ts");
const {
  skus, cigarCatalog, stockLocations, stockSuppliers, stockReceipts, stockProvenanceLots, stockReceiptItems,
} = await import("../shared/schema.stock.ts");
const { products } = await import("../shared/schema.mysql.ts");

const runId = Date.now().toString(36).toUpperCase();
const SKU = `M6-${runId}`;
const CIGAR_ID = `M6C${runId}`.slice(0, 20);
const STORE = randomUUID();
const PARTNER = randomUUID();
const EVENT = randomUUID();
const SUPPLIER = randomUUID();
const RECEIPT_A = randomUUID();
const RECEIPT_B = randomUUID();
const LOT_A = randomUUID();
const LOT_B = randomUUID();

await db.insert(skus).values({ sku: SKU, kind: "CIGAR" });
await db.insert(cigarCatalog).values({ cigarId: CIGAR_ID, marque: "M6", ligne: "Operational Admin", vitole: "Lifecycle" });
await db.insert(products).values({ sku: SKU, cigarId: CIGAR_ID, marque: "M6", ligne: "Operational Admin", vitole: "Lifecycle" });
await db.insert(stockLocations).values([
  { locationId: STORE, code: `M6_STORE_${runId}`, name: "M6 store", category: "CITI_STORAGE" },
  { locationId: PARTNER, code: `M6_PARTNER_${runId}`, name: "M6 partner", category: "PARTNER" },
  { locationId: EVENT, code: `M6_EVENT_${runId}`, name: "M6 event", category: "EVENT" },
]);
await db.insert(stockSuppliers).values({ supplierId: SUPPLIER, code: `M6_SUP_${runId}`, name: "M6 supplier" });
await db.insert(stockReceipts).values([
  { receiptId: RECEIPT_A, receiptCode: `M6_REC_A_${runId}`, supplierId: SUPPLIER, destinationLocationId: STORE, receivedAt: new Date("2026-06-01T10:00:00Z"), author: "m6-fixture" },
  { receiptId: RECEIPT_B, receiptCode: `M6_REC_B_${runId}`, supplierId: SUPPLIER, destinationLocationId: STORE, receivedAt: new Date("2026-07-01T10:00:00Z"), author: "m6-fixture" },
]);
await db.insert(stockProvenanceLots).values([
  { lotId: LOT_A, lotCode: `M6_LOT_A_${runId}`, originKind: "RECEIPT", receiptId: RECEIPT_A },
  { lotId: LOT_B, lotCode: `M6_LOT_B_${runId}`, originKind: "RECEIPT", receiptId: RECEIPT_B },
]);
await db.insert(stockReceiptItems).values([
  { receiptItemId: randomUUID(), receiptId: RECEIPT_A, lotId: LOT_A, sku: SKU, type: "Box", packSize: 0, quantity: 5 },
  { receiptItemId: randomUUID(), receiptId: RECEIPT_B, lotId: LOT_B, sku: SKU, type: "Box", packSize: 0, quantity: 5 },
]);

const app = express();
app.use(express.json());
registerStockAdminRoutes(app);
registerStockTraceabilityRoutes(app);
const server = createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const base = `http://127.0.0.1:${address.port}`;
const token = Buffer.from(process.env.CMS_ADMIN_PASSWORD).toString("base64");
async function request(path, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), "x-cms-token": token } });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}
const tracePath = () => `/api/admin/stock/${encodeURIComponent(SKU)}/traceability?type=Box&limit=100`;
async function traceAfter(label, operationCount, expected) {
  const { response, body } = await request(tracePath());
  const actual = body.aggregate?.buckets;
  const expectedMatches = Object.entries(expected).every(([key, value]) => actual?.[key] === value);
  const allocationsReconcile = body.history?.operations?.every((operation) => operation.allocationConsistency.status === "RECONCILED");
  check(response.status === 200 && body.reconciliation?.status === "RECONCILED" && body.history?.total === operationCount && expectedMatches && allocationsReconcile,
    `${label}: M5 immediately proves aggregate, locations, lots, history, and allocations`, { status: response.status, aggregate: actual, total: body.history?.total, reconciliation: body.reconciliation });
  return body;
}
async function move(payload, expected, label) {
  const { response, body } = await request("/api/admin/stock/movements", { method: "POST", body: JSON.stringify({ sku: SKU, type: "Box", packSize: 0, author: "m6-operator", ...payload }) });
  check(response.status === 201 && typeof body.groupId === "string", `${label}: authenticated admin write returns immutable groupId`, { status: response.status, body });
  const trace = await traceAfter(label, expected.count, expected.buckets);
  check(trace.history.operations.some((operation) => operation.groupId === body.groupId), `${label}: resulting group is visible in immutable history`, body);
  return { groupId: body.groupId, trace };
}

console.log("=== Milestone 6 disposable MariaDB operational rehearsal ===");
const unauthorized = await fetch(base + "/api/admin/stock/locations");
check(unauthorized.status === 401, "all operational admin reads require existing admin auth", { status: unauthorized.status });
const list = await request(`/api/admin/stock?search=${encodeURIComponent(SKU)}`);
check(list.response.status === 200 && list.body.positions.length === 1 && list.body.positions[0].hasPosition === false, "stock search exposes the known SKU before any materialized position", list.body);
const locations = await request("/api/admin/stock/locations");
check(locations.response.status === 200 && [STORE, PARTNER, EVENT].every((id) => locations.body.locations.some((row) => row.locationId === id)), "location selector receives codes/names/categories instead of requiring UUID entry", locations.body);
const receptionLots = await request(`/api/admin/stock/reception-lots?sku=${encodeURIComponent(SKU)}&type=Box&packSize=0&destinationLocationId=${STORE}`);
check(receptionLots.response.status === 200 && receptionLots.body.lots.map((row) => row.lotId).join(",") === [LOT_A, LOT_B].join(","), "reception UX receives only evidenced lots for the exact identity and destination", receptionLots.body);

await move({ movementType: "RECEPTION", qty: 5, destinationLocationId: STORE, lotId: LOT_A, referenceType: "OTHER", referenceId: `REC-A-${runId}` }, { count: 1, buckets: { onHand: 5 } }, "first evidenced reception");
await move({ movementType: "RECEPTION", qty: 5, destinationLocationId: STORE, lotId: LOT_B, referenceType: "OTHER", referenceId: `REC-B-${runId}` }, { count: 2, buckets: { onHand: 10 } }, "second evidenced reception");
await move({ movementType: "RESERVATION_CLIENT", qty: 2, sourceLocationId: STORE, referenceType: "CLIENT", referenceId: `CLIENT-${runId}` }, { count: 3, buckets: { onHand: 10, reservedClient: 2 } }, "client reservation");
await move({ movementType: "LIBERATION_RESERVATION_CLIENT", qty: 1, sourceLocationId: STORE, referenceType: "CLIENT", referenceId: `CLIENT-${runId}` }, { count: 4, buckets: { onHand: 10, reservedClient: 1 } }, "client reservation release");
await move({ movementType: "MISE_EN_DEPOT", qty: 2, sourceLocationId: STORE, destinationLocationId: PARTNER, referenceType: "PARTNER", referenceId: `PARTNER-${runId}` }, { count: 5, buckets: { onHand: 8, deposit: 2 } }, "same-lot deposit transfer");
await move({ movementType: "RETOUR_DE_DEPOT", qty: 1, sourceLocationId: PARTNER, destinationLocationId: STORE, referenceType: "PARTNER", referenceId: `PARTNER-${runId}` }, { count: 6, buckets: { onHand: 9, deposit: 1 } }, "deposit return");
await move({ movementType: "RESERVATION_EVENEMENT", qty: 2, sourceLocationId: STORE, referenceType: "EVENT", referenceId: `EVENT-${runId}` }, { count: 7, buckets: { onHand: 9, reservedClient: 1, reservedEvent: 2, deposit: 1 } }, "event reservation");
await move({ movementType: "SORTIE_EVENEMENT", qty: 2, sourceLocationId: STORE, destinationLocationId: EVENT, referenceType: "EVENT", referenceId: `EVENT-${runId}` }, { count: 8, buckets: { onHand: 7, reservedClient: 1, reservedEvent: 0, atEvent: 2, deposit: 1 } }, "event sortie");
await move({ movementType: "RETOUR_EVENEMENT", qty: 1, sourceLocationId: EVENT, destinationLocationId: STORE, referenceType: "EVENT", referenceId: `EVENT-${runId}` }, { count: 9, buckets: { onHand: 8, reservedClient: 1, atEvent: 1, deposit: 1 } }, "partial event return");
const correction = await move({ movementType: "CORRECTION_INVENTAIRE", qty: 6, sourceLocationId: STORE, motif: "Comptage physique M6", referenceType: "OTHER", referenceId: `COUNT-${runId}` }, { count: 10, buckets: { onHand: 6, reservedClient: 1, atEvent: 1, deposit: 1 } }, "location-specific counted correction");

const finalTrace = correction.trace;
const store = finalTrace.locations.find((row) => row.locationId === STORE);
const partner = finalTrace.locations.find((row) => row.locationId === PARTNER);
const event = finalTrace.locations.find((row) => row.locationId === EVENT);
check(store?.buckets.onHand === 6 && store?.buckets.reservedClient === 1 && partner?.buckets.deposit === 1 && event?.buckets.atEvent === 1,
  "final operational view identifies exact quantities at STORE, PARTNER, and EVENT", { store, partner, event });
check(finalTrace.lots.length >= 3 && finalTrace.lots.every((lot) => lot.originKind === "RECEIPT" && lot.supplierId === SUPPLIER),
  "final operational view preserves evidenced provenance across transferred lot/location positions", finalTrace.lots);

await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
await db.$client.end();
console.log(`=== MILESTONE 6 RESULT: ${pass} OK, ${fail} FAIL ===`);
process.exitCode = fail > 0 ? 1 : 0;
