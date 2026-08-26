import { and, asc, countDistinct, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db.mysql";
import { products } from "../../shared/schema.mysql";
import {
  skus,
  stockBalances,
  stockLocations,
  stockLocationBalances,
  stockMovementGroups,
  stockMovements,
  stockMovementLotAllocations,
  stockProvenanceLots,
  stockReceipts,
  stockSuppliers,
  stockLotLocationBalances,
  type StockType,
} from "../../shared/schema.stock";
import {
  allocationConsistency,
  assertTraceabilityReconciled,
  compareChronologicalGroups,
  describeBalance,
  projectionRowToBalance,
  TraceabilityNotFoundError,
} from "./stock-traceability-model";

type Identity = { sku: string; type: StockType; packSize: number };
type HistoryPage = { limit: number; offset: number };
type ReadTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const TYPE_ORDER: Record<StockType, number> = { Box: 0, Pack: 1, Loose: 2, Accessory: 3 };

function identityPredicate(identity: Identity) {
  return and(eq(stockBalances.sku, identity.sku), eq(stockBalances.type, identity.type), eq(stockBalances.packSize, identity.packSize));
}

function movementIdentityPredicate(identity: Identity) {
  return and(eq(stockMovements.sku, identity.sku), eq(stockMovements.type, identity.type), eq(stockMovements.packSize, identity.packSize));
}

async function getSkuIdentity(sku: string, reader: ReadTx) {
  const [row] = await reader.select({
    sku: skus.sku,
    kind: skus.kind,
    cigarId: products.cigarId,
    marque: products.marque,
    ligne: products.ligne,
    vitole: products.vitole,
  }).from(skus).leftJoin(products, eq(products.sku, skus.sku)).where(eq(skus.sku, sku)).limit(1);
  if (!row) throw new TraceabilityNotFoundError("sku_not_found");
  return row;
}

async function readStockSummary(sku: string, filter: { type?: StockType; packSize?: number }, reader: ReadTx) {
  const skuIdentity = await getSkuIdentity(sku, reader);
  const conditions = [eq(stockBalances.sku, sku)];
  if (filter.type) conditions.push(eq(stockBalances.type, filter.type));
  if (filter.packSize !== undefined) conditions.push(eq(stockBalances.packSize, filter.packSize));
  const rows = await reader.select().from(stockBalances).where(and(...conditions));
  const positions = rows.map((row) => ({
    identity: { sku: row.sku, type: row.type, packSize: row.packSize },
    hasPosition: true,
    ...describeBalance(projectionRowToBalance(row)),
    updatedAt: row.updatedAt,
    lastMovementGroupId: row.lastMovementGroupId,
  })).sort((a, b) => TYPE_ORDER[a.identity.type] - TYPE_ORDER[b.identity.type] || a.identity.packSize - b.identity.packSize);

  if (filter.type && filter.packSize !== undefined && positions.length === 0) {
    positions.push({
      identity: { sku, type: filter.type, packSize: filter.packSize },
      hasPosition: false,
      ...describeBalance(projectionRowToBalance(undefined)),
      updatedAt: null,
      lastMovementGroupId: null,
    });
  }
  return { sku: skuIdentity, positions };
}

export async function getStockSummary(sku: string, filter: { type?: StockType; packSize?: number }) {
  return db.transaction((reader) => readStockSummary(sku, filter, reader));
}

async function loadOperationGroups(groupIds: string[], reader: ReadTx) {
  if (!groupIds.length) return [];
  const [headers, details, allocations] = await Promise.all([
    reader.select().from(stockMovementGroups).where(inArray(stockMovementGroups.groupId, groupIds)),
    reader.select().from(stockMovements).where(inArray(stockMovements.groupId, groupIds)).orderBy(asc(stockMovements.id)),
    reader.select({
      id: stockMovementLotAllocations.id,
      groupId: stockMovementLotAllocations.groupId,
      lotId: stockMovementLotAllocations.lotId,
      lotCode: stockProvenanceLots.lotCode,
      originKind: stockProvenanceLots.originKind,
      locationId: stockMovementLotAllocations.locationId,
      locationCode: stockLocations.code,
      sku: stockMovementLotAllocations.sku,
      type: stockMovementLotAllocations.type,
      packSize: stockMovementLotAllocations.packSize,
      balanceField: stockMovementLotAllocations.balanceField,
      qtyDelta: stockMovementLotAllocations.qtyDelta,
      qtyBefore: stockMovementLotAllocations.qtyBefore,
      qtyAfter: stockMovementLotAllocations.qtyAfter,
      createdAt: stockMovementLotAllocations.createdAt,
    }).from(stockMovementLotAllocations)
      .innerJoin(stockProvenanceLots, eq(stockProvenanceLots.lotId, stockMovementLotAllocations.lotId))
      .innerJoin(stockLocations, eq(stockLocations.locationId, stockMovementLotAllocations.locationId))
      .where(inArray(stockMovementLotAllocations.groupId, groupIds))
      .orderBy(asc(stockMovementLotAllocations.id)),
  ]);
  const locationIds = Array.from(new Set(headers.flatMap((row) => [row.sourceLocationId, row.destinationLocationId]).filter((id): id is string => Boolean(id))));
  const locationRows = locationIds.length ? await reader.select().from(stockLocations).where(inArray(stockLocations.locationId, locationIds)) : [];
  const locationsById = new Map(locationRows.map((row) => [row.locationId, row]));
  const order = new Map(groupIds.map((id, index) => [id, index]));

  return headers.map((header) => {
    const groupDetails = details.filter((row) => row.groupId === header.groupId);
    const groupAllocations = allocations.filter((row) => row.groupId === header.groupId);
    return {
      ...header,
      sourceLocation: header.sourceLocationId ? locationsById.get(header.sourceLocationId) ?? null : null,
      destinationLocation: header.destinationLocationId ? locationsById.get(header.destinationLocationId) ?? null : null,
      details: groupDetails,
      lotAllocations: groupAllocations,
      allocationConsistency: allocationConsistency(groupDetails, groupAllocations),
    };
  }).sort((a, b) => (order.get(a.groupId) ?? 0) - (order.get(b.groupId) ?? 0));
}

async function loadHistory(identity: Identity, page: HistoryPage, reader: ReadTx) {
  const [[totalRow], candidates] = await Promise.all([
    reader.select({ total: countDistinct(stockMovements.groupId) }).from(stockMovements).where(movementIdentityPredicate(identity)),
    reader.selectDistinct({
      groupId: stockMovementGroups.groupId,
      movementDate: stockMovementGroups.movementDate,
      createdAt: stockMovementGroups.createdAt,
    }).from(stockMovementGroups)
      .innerJoin(stockMovements, eq(stockMovements.groupId, stockMovementGroups.groupId))
      .where(movementIdentityPredicate(identity))
      .orderBy(
        asc(sql`COALESCE(${stockMovementGroups.movementDate}, ${stockMovementGroups.createdAt})`),
        asc(stockMovementGroups.createdAt),
        asc(stockMovementGroups.groupId),
      )
      .limit(page.limit)
      .offset(page.offset),
  ]);
  candidates.sort(compareChronologicalGroups);
  return {
    limit: page.limit,
    offset: page.offset,
    total: Number(totalRow?.total ?? 0),
    operations: await loadOperationGroups(candidates.map((row) => row.groupId), reader),
  };
}

async function readStockTraceability(identity: Identity, page: HistoryPage, reader: ReadTx) {
  const skuIdentity = await getSkuIdentity(identity.sku, reader);
  const [aggregateRows, locationRows, lotRows, history] = await Promise.all([
    reader.select().from(stockBalances).where(identityPredicate(identity)).limit(1),
    reader.select({
      locationId: stockLocationBalances.locationId,
      code: stockLocations.code,
      name: stockLocations.name,
      category: stockLocations.category,
      active: stockLocations.active,
      isSystem: stockLocations.isSystem,
      onHandQty: stockLocationBalances.onHandQty,
      reservedClientQty: stockLocationBalances.reservedClientQty,
      reservedEventQty: stockLocationBalances.reservedEventQty,
      atEventQty: stockLocationBalances.atEventQty,
      depositQty: stockLocationBalances.depositQty,
      transitQty: stockLocationBalances.transitQty,
      updatedAt: stockLocationBalances.updatedAt,
      lastMovementGroupId: stockLocationBalances.lastMovementGroupId,
    }).from(stockLocationBalances)
      .innerJoin(stockLocations, eq(stockLocations.locationId, stockLocationBalances.locationId))
      .where(and(eq(stockLocationBalances.sku, identity.sku), eq(stockLocationBalances.type, identity.type), eq(stockLocationBalances.packSize, identity.packSize))),
    reader.select({
      lotId: stockLotLocationBalances.lotId,
      lotCode: stockProvenanceLots.lotCode,
      originKind: stockProvenanceLots.originKind,
      sourceReference: stockProvenanceLots.sourceReference,
      lotCreatedAt: stockProvenanceLots.createdAt,
      locationId: stockLotLocationBalances.locationId,
      locationCode: stockLocations.code,
      receiptId: stockReceipts.receiptId,
      receiptCode: stockReceipts.receiptCode,
      receivedAt: stockReceipts.receivedAt,
      purchaseReference: stockReceipts.purchaseReference,
      invoiceReference: stockReceipts.invoiceReference,
      supplierId: stockSuppliers.supplierId,
      supplierCode: stockSuppliers.code,
      supplierName: stockSuppliers.name,
      onHandQty: stockLotLocationBalances.onHandQty,
      reservedClientQty: stockLotLocationBalances.reservedClientQty,
      reservedEventQty: stockLotLocationBalances.reservedEventQty,
      atEventQty: stockLotLocationBalances.atEventQty,
      depositQty: stockLotLocationBalances.depositQty,
      transitQty: stockLotLocationBalances.transitQty,
      updatedAt: stockLotLocationBalances.updatedAt,
      lastMovementGroupId: stockLotLocationBalances.lastMovementGroupId,
    }).from(stockLotLocationBalances)
      .innerJoin(stockProvenanceLots, eq(stockProvenanceLots.lotId, stockLotLocationBalances.lotId))
      .innerJoin(stockLocations, eq(stockLocations.locationId, stockLotLocationBalances.locationId))
      .leftJoin(stockReceipts, eq(stockReceipts.receiptId, stockProvenanceLots.receiptId))
      .leftJoin(stockSuppliers, eq(stockSuppliers.supplierId, stockReceipts.supplierId))
      .where(and(eq(stockLotLocationBalances.sku, identity.sku), eq(stockLotLocationBalances.type, identity.type), eq(stockLotLocationBalances.packSize, identity.packSize))),
    loadHistory(identity, page, reader),
  ]);

  const aggregateBalance = projectionRowToBalance(aggregateRows[0]);
  const locations = locationRows.map((row) => ({ ...row, balance: projectionRowToBalance(row) }));
  const lots = lotRows.map((row) => ({ ...row, balance: projectionRowToBalance(row) }));
  const reconciliation = assertTraceabilityReconciled(aggregateBalance, locations, lots);
  const visibleLocations = locations.map(({ balance, ...row }) => ({ ...row, ...describeBalance(balance) }))
    .filter((row) => !row.isZero)
    .sort((a, b) => a.code.localeCompare(b.code) || a.locationId.localeCompare(b.locationId));
  const visibleLots = lots.map(({ balance, ...row }) => ({ ...row, ...describeBalance(balance) }))
    .filter((row) => !row.isZero)
    .sort((a, b) => a.locationCode.localeCompare(b.locationCode)
      || (a.receivedAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.receivedAt?.getTime() ?? Number.MAX_SAFE_INTEGER)
      || (a.lotCreatedAt?.getTime() ?? 0) - (b.lotCreatedAt?.getTime() ?? 0)
      || a.lotId.localeCompare(b.lotId));

  return {
    sku: skuIdentity,
    identity,
    aggregate: {
      hasPosition: Boolean(aggregateRows[0]),
      ...describeBalance(aggregateBalance),
      updatedAt: aggregateRows[0]?.updatedAt ?? null,
      lastMovementGroupId: aggregateRows[0]?.lastMovementGroupId ?? null,
    },
    locations: visibleLocations,
    lots: visibleLots,
    zeroPositionPolicy: "Materialized zero rows participate in reconciliation but are omitted from current locations and lots.",
    unknownEvidencePolicy: "LEGACY_UNKNOWN values and null evidence are returned as stored; the API never infers provenance or physical location.",
    reconciliation,
    history,
  };
}

export async function getStockTraceability(identity: Identity, page: HistoryPage) {
  // MariaDB/InnoDB's transaction snapshot keeps aggregate, location, lot, and
  // ledger reads on one coherent point in time while writers continue normally.
  return db.transaction((reader) => readStockTraceability(identity, page, reader));
}

export async function getMovementGroup(groupId: string) {
  return db.transaction(async (reader) => {
    const operations = await loadOperationGroups([groupId], reader);
    if (!operations.length) throw new TraceabilityNotFoundError("movement_group_not_found");
    return operations[0];
  });
}
