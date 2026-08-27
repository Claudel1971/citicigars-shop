import { randomUUID } from "node:crypto";
import { and, eq, like } from "drizzle-orm";

const databaseUrl = process.env.MYSQL_URL;
const mode = process.argv[2];
if (!databaseUrl || !["--apply-disposable-demo", "--apply-exact-staging-demo"].includes(mode)) {
  throw new Error("Usage: MYSQL_URL=... node scripts/staging-phase2-demo-fixtures.mjs <--apply-disposable-demo|--apply-exact-staging-demo>");
}
const target = new URL(databaseUrl);
const disposable = mode === "--apply-disposable-demo"
  && target.hostname === "127.0.0.1"
  && target.port === "3399"
  && target.pathname.startsWith("/citicigars_");
const exactStaging = mode === "--apply-exact-staging-demo"
  && target.hostname === "srv18.swhc.ca"
  && (target.port === "3306" || target.port === "")
  && target.pathname === "/bwljrj22_citicigars_staging";
if (!disposable && !exactStaging) {
  throw new Error(`STOP_UNAUTHORIZED_DEMO_TARGET: ${target.hostname}:${target.port}${target.pathname}`);
}

const { db, mysqlPool } = await import("../server/db.mysql.ts");
const { stockStorage } = await import("../server/storage.stock.ts");
const {
  createPurchaseOrder,
  createReceipt,
  createSupplier,
  getPurchaseOrder,
} = await import("../server/services/purchasing.ts");
const { createManualSale } = await import("../server/services/manual-sale.ts");
const { getStockMonitoring } = await import("../server/services/stock-monitoring.ts");
const { customers } = await import("../shared/schema.crm.ts");
const { products } = await import("../shared/schema.mysql.ts");
const {
  cigarCatalog,
  skus,
  stockLocations,
  stockMovementGroups,
  stockSuppliers,
} = await import("../shared/schema.stock.ts");

const IDS = {
  store: "51000000-0000-4000-8000-000000000001",
  partner: "51000000-0000-4000-8000-000000000002",
  event: "51000000-0000-4000-8000-000000000003",
  customer: "52000000-0000-4000-8000-000000000001",
  poHistorical: "53000000-0000-4000-8000-000000000001",
  receiptHistorical: "53000000-0000-4000-8000-000000000002",
  poRecent: "53000000-0000-4000-8000-000000000003",
  receiptRecent: "53000000-0000-4000-8000-000000000004",
  poPartial: "53000000-0000-4000-8000-000000000005",
  receiptPartial: "53000000-0000-4000-8000-000000000006",
  poOpen: "53000000-0000-4000-8000-000000000007",
  crmSale: "53000000-0000-4000-8000-000000000008",
};

const FIXTURES = {
  available: { sku: "STG-DEMO-AVAILABLE", cigarId: "STGDEMO01", vitole: "Available Box" },
  pack: { sku: "STG-DEMO-PACK", cigarId: "STGDEMO02", vitole: "Pack of 5" },
  loose: { sku: "STG-DEMO-LOOSE", cigarId: "STGDEMO03", vitole: "Loose" },
  zero: { sku: "STG-DEMO-ZERO", cigarId: "STGDEMO04", vitole: "Out of stock" },
  low: { sku: "STG-DEMO-LOW", cigarId: "STGDEMO05", vitole: "Low stock" },
  reserved: { sku: "STG-DEMO-RESERVED", cigarId: "STGDEMO06", vitole: "Fully reserved" },
  dormant: { sku: "STG-DEMO-DORMANT", cigarId: "STGDEMO07", vitole: "Dormant old lot" },
  short: { sku: "STG-DEMO-SHORT-HISTORY", cigarId: "STGDEMO08", vitole: "Insufficient history" },
  legacy: { sku: "STG-DEMO-LEGACY", cigarId: "STGDEMO09", vitole: "Legacy unknown" },
};

async function ensureCatalogIdentity({ sku, cigarId, vitole }) {
  await db.insert(skus).values({ sku, kind: "CIGAR" }).onDuplicateKeyUpdate({ set: { kind: "CIGAR" } });
  await db.insert(cigarCatalog).values({
    cigarId, marque: "STG-DEMO", ligne: "Phase 2 Visual Acceptance", vitole,
  }).onDuplicateKeyUpdate({ set: { marque: "STG-DEMO", ligne: "Phase 2 Visual Acceptance", vitole } });
  await db.insert(products).values({
    sku, cigarId, marque: "STG-DEMO", ligne: "Phase 2 Visual Acceptance", vitole,
    inCatalogue: true, availabilityStatus: "IN_STOCK",
  }).onDuplicateKeyUpdate({ set: {
    cigarId, marque: "STG-DEMO", ligne: "Phase 2 Visual Acceptance", vitole,
    inCatalogue: true, availabilityStatus: "IN_STOCK",
  } });
}

for (const fixture of Object.values(FIXTURES)) await ensureCatalogIdentity(fixture);

for (const location of [
  { locationId: IDS.store, code: "STG-DEMO-STORE", name: "STG-DEMO Main Store", category: "CITI_STORAGE", notes: "Synthetic staging-only visual acceptance location." },
  { locationId: IDS.partner, code: "STG-DEMO-PARTNER", name: "STG-DEMO Partner Deposit", category: "PARTNER", notes: "Synthetic staging-only visual acceptance location." },
  { locationId: IDS.event, code: "STG-DEMO-EVENT", name: "STG-DEMO Event", category: "EVENT", notes: "Synthetic staging-only visual acceptance location." },
]) {
  await db.insert(stockLocations).values(location).onDuplicateKeyUpdate({ set: {
    name: location.name, category: location.category, notes: location.notes, active: true,
  } });
}

await db.insert(customers).values({
  customerId: IDS.customer,
  firstName: "STG-DEMO",
  lastName: "Visual Acceptance",
  status: "CUSTOMER",
  notes: "Synthetic staging-only customer for the CRM stock-aware sale walkthrough.",
}).onDuplicateKeyUpdate({ set: {
  firstName: "STG-DEMO", lastName: "Visual Acceptance", status: "CUSTOMER",
  notes: "Synthetic staging-only customer for the CRM stock-aware sale walkthrough.",
} });

let [supplier] = await db.select().from(stockSuppliers).where(eq(stockSuppliers.code, "STG-DEMO-SUPPLIER"));
if (!supplier) {
  const created = await createSupplier({
    code: "STG-DEMO-SUPPLIER",
    name: "STG-DEMO Provenance Supplier",
    notes: "Synthetic staging-only supplier for Phase 2 visual acceptance.",
  });
  [supplier] = await db.select().from(stockSuppliers).where(eq(stockSuppliers.supplierId, created.supplierId));
}

const historicalLines = [
  { ...FIXTURES.available, type: "Box", packSize: 0, orderedQuantity: 10 },
  { ...FIXTURES.pack, type: "Pack", packSize: 5, orderedQuantity: 6 },
  { ...FIXTURES.loose, type: "Loose", packSize: 0, orderedQuantity: 4 },
  { ...FIXTURES.zero, type: "Box", packSize: 0, orderedQuantity: 1 },
  { ...FIXTURES.low, type: "Box", packSize: 0, orderedQuantity: 2 },
  { ...FIXTURES.reserved, type: "Box", packSize: 0, orderedQuantity: 3 },
  { ...FIXTURES.dormant, type: "Box", packSize: 0, orderedQuantity: 4 },
].map(({ sku, type, packSize, orderedQuantity }) => ({ sku, type, packSize, orderedQuantity }));

const historicalPo = await createPurchaseOrder({
  clientRequestId: IDS.poHistorical,
  supplierId: supplier.supplierId,
  orderedAt: "2025-01-02T10:00:00Z",
  expectedAt: "2025-01-15T10:00:00Z",
  purchaseReference: "STG-DEMO-PO-RECEIVED",
  notes: "Fully received synthetic PO; creates evidenced old lots for visual review.",
  createdBy: "STG-DEMO fixture",
  lines: historicalLines,
});
await createReceipt({
  clientRequestId: IDS.receiptHistorical,
  purchaseOrderId: historicalPo.purchaseOrderId,
  destinationLocationId: IDS.store,
  receivedAt: "2025-01-10T10:00:00Z",
  author: "STG-DEMO fixture",
  invoiceReference: "STG-DEMO-INVOICE-OLD",
  notes: "Synthetic fully received stock with explicit provenance.",
  lines: historicalPo.items.map((item) => ({
    purchaseOrderItemId: item.purchaseOrderItemId,
    sku: item.sku,
    type: item.type,
    packSize: item.packSize,
    receivedQuantity: item.orderedQuantity,
  })),
});

const recentPo = await createPurchaseOrder({
  clientRequestId: IDS.poRecent,
  supplierId: supplier.supplierId,
  orderedAt: "2026-08-24T10:00:00Z",
  expectedAt: "2026-08-25T10:00:00Z",
  purchaseReference: "STG-DEMO-PO-RECENT",
  createdBy: "STG-DEMO fixture",
  lines: [{ sku: FIXTURES.short.sku, type: "Box", packSize: 0, orderedQuantity: 4 }],
});
await createReceipt({
  clientRequestId: IDS.receiptRecent,
  purchaseOrderId: recentPo.purchaseOrderId,
  destinationLocationId: IDS.store,
  receivedAt: "2026-08-25T10:00:00Z",
  author: "STG-DEMO fixture",
  invoiceReference: "STG-DEMO-INVOICE-RECENT",
  lines: [{
    purchaseOrderItemId: recentPo.items[0].purchaseOrderItemId,
    sku: FIXTURES.short.sku, type: "Box", packSize: 0, receivedQuantity: 4,
  }],
});

const partialPo = await createPurchaseOrder({
  clientRequestId: IDS.poPartial,
  supplierId: supplier.supplierId,
  orderedAt: "2025-02-01T10:00:00Z",
  expectedAt: "2025-02-15T10:00:00Z",
  purchaseReference: "STG-DEMO-PO-PARTIAL-OVERDUE",
  notes: "Synthetic overdue PO: 2 received, 8 outstanding.",
  createdBy: "STG-DEMO fixture",
  lines: [{ sku: FIXTURES.dormant.sku, type: "Box", packSize: 0, orderedQuantity: 10 }],
});
await createReceipt({
  clientRequestId: IDS.receiptPartial,
  purchaseOrderId: partialPo.purchaseOrderId,
  destinationLocationId: IDS.store,
  receivedAt: "2025-02-10T10:00:00Z",
  author: "STG-DEMO fixture",
  invoiceReference: "STG-DEMO-INVOICE-PARTIAL",
  lines: [{
    purchaseOrderItemId: partialPo.items[0].purchaseOrderItemId,
    sku: FIXTURES.dormant.sku, type: "Box", packSize: 0, receivedQuantity: 2,
  }],
});

const openPo = await createPurchaseOrder({
  clientRequestId: IDS.poOpen,
  supplierId: supplier.supplierId,
  orderedAt: "2026-08-26T10:00:00Z",
  expectedAt: "2027-01-15T10:00:00Z",
  purchaseReference: "STG-DEMO-PO-OPEN",
  notes: "Synthetic future open PO with no receipt.",
  createdBy: "STG-DEMO fixture",
  lines: [{ sku: FIXTURES.pack.sku, type: "Pack", packSize: 5, orderedQuantity: 5 }],
});

async function ensureMovement(referenceId, input) {
  const existing = await db.select({ groupId: stockMovementGroups.groupId })
    .from(stockMovementGroups)
    .where(and(eq(stockMovementGroups.referenceType, "OTHER"), eq(stockMovementGroups.referenceId, referenceId)));
  if (existing.length) return existing[0];
  return stockStorage.applyLocationMovement({
    ...input,
    author: "STG-DEMO fixture",
    referenceType: "OTHER",
    referenceLabel: referenceId,
    referenceId,
  });
}

await ensureMovement("STG-DEMO-MOVE-ZERO", {
  sku: FIXTURES.zero.sku, type: "Box", packSize: 0, movementType: "VENTE", qty: 1,
  sourceLocationId: IDS.store, movementDate: new Date("2026-08-20T10:00:00Z"),
});
await ensureMovement("STG-DEMO-MOVE-FULL-RESERVATION", {
  sku: FIXTURES.reserved.sku, type: "Box", packSize: 0, movementType: "RESERVATION_CLIENT", qty: 3,
  sourceLocationId: IDS.store,
});
await ensureMovement("STG-DEMO-MOVE-AVAILABLE-RESERVATION", {
  sku: FIXTURES.available.sku, type: "Box", packSize: 0, movementType: "RESERVATION_CLIENT", qty: 1,
  sourceLocationId: IDS.store,
});
await ensureMovement("STG-DEMO-MOVE-EVENT-RESERVATION", {
  sku: FIXTURES.available.sku, type: "Box", packSize: 0, movementType: "RESERVATION_EVENEMENT", qty: 1,
  sourceLocationId: IDS.store,
});
await ensureMovement("STG-DEMO-MOVE-EVENT-OUT", {
  sku: FIXTURES.available.sku, type: "Box", packSize: 0, movementType: "SORTIE_EVENEMENT", qty: 1,
  sourceLocationId: IDS.store, destinationLocationId: IDS.event,
});
await ensureMovement("STG-DEMO-MOVE-EVENT-RETURN", {
  sku: FIXTURES.available.sku, type: "Box", packSize: 0, movementType: "RETOUR_EVENEMENT", qty: 1,
  sourceLocationId: IDS.event, destinationLocationId: IDS.store,
});
await ensureMovement("STG-DEMO-MOVE-PARTNER-DEPOSIT", {
  sku: FIXTURES.available.sku, type: "Box", packSize: 0, movementType: "MISE_EN_DEPOT", qty: 1,
  sourceLocationId: IDS.store, destinationLocationId: IDS.partner,
});

await createManualSale({
  clientRequestId: IDS.crmSale,
  author: "STG-DEMO fixture",
  customerId: IDS.customer,
  orderDate: "2026-08-26T11:00:00Z",
  paymentMethod: "OTHER",
  notes: "STG-DEMO stock-aware CRM sale; synthetic staging-only data.",
  lines: [{
    itemType: "PRODUCT",
    sku: FIXTURES.available.sku,
    brand: "STG-DEMO",
    series: "Phase 2 Visual Acceptance",
    vitole: FIXTURES.available.vitole,
    quantity: 1,
    regularUnitPriceXaf: 1000,
    stockDisposition: "CONSUME",
    stockType: "Box",
    stockPackSize: 0,
    sourceLocationId: IDS.store,
  }],
});

const legacyGroup = await db.select({ groupId: stockMovementGroups.groupId })
  .from(stockMovementGroups)
  .where(and(eq(stockMovementGroups.referenceType, "OTHER"), eq(stockMovementGroups.referenceId, "STG-DEMO-MOVE-LEGACY")));
if (!legacyGroup.length) {
  await stockStorage.applyMovement({
    sku: FIXTURES.legacy.sku,
    type: "Box",
    packSize: 0,
    movementType: "RECEPTION",
    qty: 2,
    author: "STG-DEMO fixture",
    referenceType: "OTHER",
    referenceLabel: "STG-DEMO explicit legacy unknown",
    referenceId: "STG-DEMO-MOVE-LEGACY",
    movementDate: new Date("2025-01-10T10:00:00Z"),
  });
}

const bucketColumns = ["on_hand_qty", "reserved_client_qty", "reserved_event_qty", "at_event_qty", "deposit_qty", "transit_qty"];
const sums = bucketColumns.map((column) => `SUM(\`${column}\`) AS \`${column}\``).join(", ");
const mismatch = bucketColumns.map((column) => `COALESCE(parent.\`${column}\`,0)<>COALESCE(child.\`${column}\`,0)`).join(" OR ");
const [aggregateLocationResult, locationLotResult, negativeResult, fixtureCountsResult] = await Promise.all([
  mysqlPool.query(`SELECT COUNT(*) AS n FROM stock_balances parent LEFT JOIN (SELECT sku,type,pack_size,${sums} FROM stock_location_balances GROUP BY sku,type,pack_size) child USING(sku,type,pack_size) WHERE ${mismatch}`),
  mysqlPool.query(`SELECT COUNT(*) AS n FROM stock_location_balances parent LEFT JOIN (SELECT location_id,sku,type,pack_size,${sums} FROM stock_lot_location_balances GROUP BY location_id,sku,type,pack_size) child USING(location_id,sku,type,pack_size) WHERE ${mismatch}`),
  mysqlPool.query(`SELECT (SELECT COUNT(*) FROM stock_balances WHERE ${bucketColumns.map((column) => `\`${column}\`<0`).join(" OR ")})+(SELECT COUNT(*) FROM stock_location_balances WHERE ${bucketColumns.map((column) => `\`${column}\`<0`).join(" OR ")})+(SELECT COUNT(*) FROM stock_lot_location_balances WHERE ${bucketColumns.map((column) => `\`${column}\`<0`).join(" OR ")}) AS n`),
  mysqlPool.query("SELECT (SELECT COUNT(*) FROM skus WHERE sku LIKE 'STG-DEMO-%') AS skus,(SELECT COUNT(*) FROM stock_suppliers WHERE code LIKE 'STG-DEMO-%') AS suppliers,(SELECT COUNT(*) FROM stock_purchase_orders WHERE purchase_reference LIKE 'STG-DEMO-%') AS purchaseOrders,(SELECT COUNT(*) FROM stock_movement_groups WHERE reference_id LIKE 'STG-DEMO-%') AS namedMovements"),
]);
const [aggregateLocation] = aggregateLocationResult[0];
const [locationLot] = locationLotResult[0];
const [negative] = negativeResult[0];
const [fixtureCounts] = fixtureCountsResult[0];
if (Number(aggregateLocation.n) || Number(locationLot.n) || Number(negative.n)) {
  throw new Error(`STG_DEMO_RECONCILIATION_FAILED aggregateLocation=${aggregateLocation.n} locationLot=${locationLot.n} negative=${negative.n}`);
}

const monitoring = await getStockMonitoring({ search: "STG-DEMO", limit: "100", lowStockThreshold: "2", dormantDays: "90", oldLotDays: "180" }, new Date("2026-08-26T12:00:00Z"));
const hasAlert = (sku, type) => monitoring.alerts.rows.some((row) => row.identity?.sku === sku && row.type === type);
const requiredMonitoring = {
  outOfStock: hasAlert(FIXTURES.zero.sku, "OUT_OF_STOCK"),
  lowStock: hasAlert(FIXTURES.low.sku, "LOW_STOCK"),
  fullyReserved: hasAlert(FIXTURES.reserved.sku, "FULLY_RESERVED"),
  dormant: hasAlert(FIXTURES.dormant.sku, "DORMANT"),
  legacyUnknown: hasAlert(FIXTURES.legacy.sku, "LEGACY_UNKNOWN_EXPOSURE"),
  insufficientHistory: monitoring.dormant.rows.some((row) => row.sku === FIXTURES.short.sku && !row.historySufficient && !row.dormant),
  oldEvidencedLot: monitoring.lots.rows.some((row) => row.sku === FIXTURES.dormant.sku && row.originKind === "RECEIPT" && row.lotAgeDays >= 180),
  overduePartialPo: monitoring.purchasing.rows.some((row) => row.purchaseOrderId === partialPo.purchaseOrderId && row.status === "PARTIALLY_RECEIVED" && row.overdue && row.outstandingQuantity === 8),
  openPo: monitoring.purchasing.rows.some((row) => row.purchaseOrderId === openPo.purchaseOrderId && row.status === "ORDERED" && !row.overdue),
};
if (Object.values(requiredMonitoring).some((value) => !value)) {
  throw new Error(`STG_DEMO_MONITORING_FAILED ${JSON.stringify(requiredMonitoring)}`);
}

const finalPartial = await getPurchaseOrder(partialPo.purchaseOrderId);
console.log(JSON.stringify({
  status: "PASS",
  target: { host: target.hostname, database: target.pathname.slice(1) },
  fixtures: {
    skuPrefix: "STG-DEMO-",
    skus: Object.values(FIXTURES).map(({ sku }) => sku),
    locationCodes: ["STG-DEMO-STORE", "STG-DEMO-PARTNER", "STG-DEMO-EVENT"],
    supplierCode: supplier.code,
    purchaseReferences: ["STG-DEMO-PO-RECEIVED", "STG-DEMO-PO-RECENT", "STG-DEMO-PO-PARTIAL-OVERDUE", "STG-DEMO-PO-OPEN"],
    crmCustomer: "STG-DEMO Visual Acceptance",
  },
  counts: Object.fromEntries(Object.entries(fixtureCounts).map(([key, value]) => [key, Number(value)])),
  partialPo: { status: finalPartial.status, outstandingQuantity: finalPartial.items[0].outstandingQuantity },
  monitoring: requiredMonitoring,
  reconciliation: { aggregateLocationMismatches: 0, locationLotMismatches: 0, negativeBuckets: 0 },
}, null, 2));
await mysqlPool.end();
