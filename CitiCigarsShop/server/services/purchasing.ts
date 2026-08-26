import crypto, { randomUUID } from "crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db.mysql";
import {
  STOCK_TYPES,
  skus,
  stockLocations,
  stockMovementGroups,
  stockProvenanceLots,
  stockPurchaseOrderItems,
  stockPurchaseOrders,
  stockReceiptItems,
  stockReceipts,
  stockSuppliers,
  type StockType,
} from "../../shared/schema.stock";
import { stockStorage } from "../storage.stock";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PurchasingRuleError extends Error {
  constructor(public code: string, message = code) { super(message); }
}

export interface PurchaseIdentityInput {
  sku: string;
  type: StockType;
  packSize: number;
}

export interface CreatePurchaseOrderInput {
  clientRequestId: string;
  supplierId: string;
  orderedAt: string;
  expectedAt?: string | null;
  purchaseReference?: string | null;
  notes?: string | null;
  createdBy: string;
  lines: Array<PurchaseIdentityInput & { orderedQuantity: number }>;
}

export interface CreateReceiptInput {
  clientRequestId: string;
  purchaseOrderId: string;
  destinationLocationId: string;
  receivedAt: string;
  author: string;
  invoiceReference?: string | null;
  shipmentReference?: string | null;
  notes?: string | null;
  lines: Array<PurchaseIdentityInput & { purchaseOrderItemId: string; receivedQuantity: number }>;
}

function cleanText(value: unknown, max: number) {
  const text = String(value || "").trim();
  if (text.length > max) throw new PurchasingRuleError("text_too_long");
  return text || null;
}

function requireUuid(value: unknown, code: string) {
  const text = String(value || "").trim();
  if (!UUID_RE.test(text)) throw new PurchasingRuleError(code);
  return text;
}

function requireActor(value: unknown) {
  const actor = cleanText(value, 100);
  if (!actor) throw new PurchasingRuleError("author_required", "Auteur opérateur requis");
  return actor;
}

function parseDate(value: unknown, code: string) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) throw new PurchasingRuleError(code);
  return date;
}

export function validatePurchaseIdentity(input: PurchaseIdentityInput, quantity: number, quantityCode: string) {
  const sku = String(input.sku || "").trim();
  if (!sku) throw new PurchasingRuleError("sku_required");
  if (!STOCK_TYPES.includes(input.type)) throw new PurchasingRuleError("invalid_stock_type");
  if (!Number.isInteger(input.packSize) || input.packSize < 0 || (input.type === "Pack" ? input.packSize <= 0 : input.packSize !== 0)) {
    throw new PurchasingRuleError("invalid_pack_size_for_stock_type");
  }
  if (!Number.isInteger(quantity) || quantity <= 0) throw new PurchasingRuleError(quantityCode);
  return { sku, type: input.type, packSize: input.packSize, quantity };
}

function identityKey(input: PurchaseIdentityInput) {
  return `${input.sku}\u0000${input.type}\u0000${String(input.packSize).padStart(10, "0")}`;
}

function assertNoDuplicateIdentities(lines: PurchaseIdentityInput[]) {
  const keys = lines.map(identityKey);
  if (new Set(keys).size !== keys.length) throw new PurchasingRuleError("duplicate_purchase_identity");
}

function hashPayload(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function code(prefix: string, id: string) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `${prefix}-${date}-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function databaseCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  if ("code" in error) return String((error as any).code);
  if ("cause" in error) return databaseCode((error as any).cause);
  return "";
}

async function receivedByPurchaseItem(reader: any, purchaseOrderId: string) {
  const rows = await reader.select({
    purchaseOrderItemId: stockReceiptItems.purchaseOrderItemId,
    receivedQuantity: sql<number>`COALESCE(SUM(${stockReceiptItems.quantity}), 0)`,
  }).from(stockReceiptItems)
    .innerJoin(stockReceipts, eq(stockReceipts.receiptId, stockReceiptItems.receiptId))
    .where(eq(stockReceipts.purchaseOrderId, purchaseOrderId))
    .groupBy(stockReceiptItems.purchaseOrderItemId);
  const result = new Map<string, number>();
  for (const row of rows) if (row.purchaseOrderItemId) result.set(row.purchaseOrderItemId, Number(row.receivedQuantity));
  return result;
}

export async function listSuppliers() {
  return db.select().from(stockSuppliers).orderBy(asc(stockSuppliers.code), asc(stockSuppliers.supplierId));
}

export function validateSupplierInput(input: { code: string; name: string; notes?: string | null }) {
  const supplierCode = String(input.code || "").trim().toUpperCase();
  const name = String(input.name || "").trim();
  if (!supplierCode || supplierCode.length > 50 || !/^[A-Z0-9][A-Z0-9_-]*$/.test(supplierCode)) throw new PurchasingRuleError("invalid_supplier_code");
  if (!name || name.length > 150) throw new PurchasingRuleError("invalid_supplier_name");
  return { code: supplierCode, name, notes: cleanText(input.notes, 2000) };
}

export async function createSupplier(input: { code: string; name: string; notes?: string | null }) {
  const validated = validateSupplierInput(input);
  const supplierId = randomUUID();
  await db.insert(stockSuppliers).values({ supplierId, ...validated });
  return { supplierId, code: validated.code, name: validated.name };
}

export async function updateSupplier(supplierId: string, input: { name?: string; notes?: string | null; active?: boolean }) {
  requireUuid(supplierId, "invalid_supplier_id");
  const values: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = String(input.name || "").trim();
    if (!name || name.length > 150) throw new PurchasingRuleError("invalid_supplier_name");
    values.name = name;
  }
  if (input.notes !== undefined) values.notes = cleanText(input.notes, 2000);
  if (input.active !== undefined) values.active = Boolean(input.active);
  if (!Object.keys(values).length) throw new PurchasingRuleError("supplier_update_required");
  const result = await db.update(stockSuppliers).set(values).where(eq(stockSuppliers.supplierId, supplierId));
  if (!(result as any)[0]?.affectedRows) throw new PurchasingRuleError("supplier_not_found");
  return { supplierId, updated: true };
}

async function loadPurchaseOrder(reader: any, purchaseOrderId: string) {
  const [order] = await reader.select({
    purchaseOrderId: stockPurchaseOrders.purchaseOrderId,
    purchaseOrderCode: stockPurchaseOrders.purchaseOrderCode,
    clientRequestId: stockPurchaseOrders.clientRequestId,
    sourceRowHash: stockPurchaseOrders.sourceRowHash,
    supplierId: stockPurchaseOrders.supplierId,
    supplierCode: stockSuppliers.code,
    supplierName: stockSuppliers.name,
    orderedAt: stockPurchaseOrders.orderedAt,
    expectedAt: stockPurchaseOrders.expectedAt,
    status: stockPurchaseOrders.status,
    purchaseReference: stockPurchaseOrders.purchaseReference,
    notes: stockPurchaseOrders.notes,
    createdBy: stockPurchaseOrders.createdBy,
    createdAt: stockPurchaseOrders.createdAt,
  }).from(stockPurchaseOrders)
    .innerJoin(stockSuppliers, eq(stockSuppliers.supplierId, stockPurchaseOrders.supplierId))
    .where(eq(stockPurchaseOrders.purchaseOrderId, purchaseOrderId));
  if (!order) return null;
  const items = await reader.select().from(stockPurchaseOrderItems)
    .where(eq(stockPurchaseOrderItems.purchaseOrderId, purchaseOrderId))
    .orderBy(asc(stockPurchaseOrderItems.sku), asc(stockPurchaseOrderItems.type), asc(stockPurchaseOrderItems.packSize));
  const received = await receivedByPurchaseItem(reader, purchaseOrderId);
  return {
    ...order,
    items: items.map((item: any) => {
      const receivedQuantity = received.get(item.purchaseOrderItemId) || 0;
      return { ...item, receivedQuantity, outstandingQuantity: item.orderedQuantity - receivedQuantity };
    }),
  };
}

export async function getPurchaseOrder(purchaseOrderId: string) {
  const result = await loadPurchaseOrder(db, purchaseOrderId);
  if (!result) throw new PurchasingRuleError("purchase_order_not_found");
  return result;
}

export async function listPurchaseOrders() {
  const rows = await db.select({ purchaseOrderId: stockPurchaseOrders.purchaseOrderId })
    .from(stockPurchaseOrders).orderBy(desc(stockPurchaseOrders.orderedAt), desc(stockPurchaseOrders.purchaseOrderId));
  return Promise.all(rows.map((row) => getPurchaseOrder(row.purchaseOrderId)));
}

async function findPurchaseOrderReplay(reader: any, clientRequestId: string, expectedHash: string) {
  const [row] = await reader.select({ id: stockPurchaseOrders.purchaseOrderId, hash: stockPurchaseOrders.sourceRowHash })
    .from(stockPurchaseOrders).where(eq(stockPurchaseOrders.clientRequestId, clientRequestId));
  if (!row) return null;
  if (row.hash !== expectedHash) throw new PurchasingRuleError("idempotency_payload_mismatch");
  return { ...(await loadPurchaseOrder(reader, row.id)), idempotentReplay: true };
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput) {
  const clientRequestId = requireUuid(input.clientRequestId, "client_request_id_required");
  const supplierId = requireUuid(input.supplierId, "supplier_required");
  const createdBy = requireActor(input.createdBy);
  const orderedAt = parseDate(input.orderedAt, "ordered_at_invalid");
  const expectedAt = input.expectedAt ? parseDate(input.expectedAt, "expected_at_invalid") : null;
  if (!Array.isArray(input.lines) || !input.lines.length) throw new PurchasingRuleError("purchase_order_lines_required");
  const lines = input.lines.map((line) => {
    const identity = validatePurchaseIdentity(line, line.orderedQuantity, "ordered_quantity_invalid");
    return { ...identity, orderedQuantity: identity.quantity };
  });
  assertNoDuplicateIdentities(lines);
  const normalized = { supplierId, orderedAt: orderedAt.toISOString(), expectedAt: expectedAt?.toISOString() || null, purchaseReference: cleanText(input.purchaseReference, 100), notes: cleanText(input.notes, 2000), createdBy, lines };
  const sourceRowHash = hashPayload(normalized);
  const replay = await findPurchaseOrderReplay(db, clientRequestId, sourceRowHash);
  if (replay) return replay;
  try {
    return await db.transaction(async (tx: any) => {
      const [supplier] = await tx.select().from(stockSuppliers).where(and(eq(stockSuppliers.supplierId, supplierId), eq(stockSuppliers.active, true)));
      if (!supplier) throw new PurchasingRuleError("supplier_not_found_or_inactive");
      const known = await tx.select({ sku: skus.sku }).from(skus).where(inArray(skus.sku, Array.from(new Set(lines.map((line) => line.sku)))));
      const knownSet = new Set(known.map((row: any) => row.sku));
      for (const line of lines) if (!knownSet.has(line.sku)) throw new PurchasingRuleError("sku_not_found", line.sku);
      const purchaseOrderId = randomUUID();
      const purchaseOrderCode = code("PO", purchaseOrderId);
      await tx.insert(stockPurchaseOrders).values({ purchaseOrderId, purchaseOrderCode, clientRequestId, sourceRowHash, supplierId, orderedAt, expectedAt, status: "ORDERED", purchaseReference: normalized.purchaseReference, notes: normalized.notes, createdBy });
      await tx.insert(stockPurchaseOrderItems).values(lines.map((line) => ({ purchaseOrderItemId: randomUUID(), purchaseOrderId, sku: line.sku, type: line.type, packSize: line.packSize, orderedQuantity: line.orderedQuantity })));
      return { ...(await loadPurchaseOrder(tx, purchaseOrderId)), idempotentReplay: false };
    });
  } catch (error) {
    if (databaseCode(error) === "ER_DUP_ENTRY") {
      const concurrent = await findPurchaseOrderReplay(db, clientRequestId, sourceRowHash);
      if (concurrent) return concurrent;
    }
    throw error;
  }
}

async function loadReceipt(reader: any, receiptId: string) {
  const [receipt] = await reader.select({
    receiptId: stockReceipts.receiptId,
    receiptCode: stockReceipts.receiptCode,
    purchaseOrderId: stockReceipts.purchaseOrderId,
    supplierId: stockReceipts.supplierId,
    supplierCode: stockSuppliers.code,
    supplierName: stockSuppliers.name,
    destinationLocationId: stockReceipts.destinationLocationId,
    destinationCode: stockLocations.code,
    destinationName: stockLocations.name,
    purchaseReference: stockReceipts.purchaseReference,
    invoiceReference: stockReceipts.invoiceReference,
    receivedAt: stockReceipts.receivedAt,
    author: stockReceipts.author,
    notes: stockReceipts.notes,
  }).from(stockReceipts)
    .innerJoin(stockSuppliers, eq(stockSuppliers.supplierId, stockReceipts.supplierId))
    .innerJoin(stockLocations, eq(stockLocations.locationId, stockReceipts.destinationLocationId))
    .where(eq(stockReceipts.receiptId, receiptId));
  if (!receipt) return null;
  const items = await reader.select({
    receiptItemId: stockReceiptItems.receiptItemId,
    purchaseOrderItemId: stockReceiptItems.purchaseOrderItemId,
    sku: stockReceiptItems.sku,
    type: stockReceiptItems.type,
    packSize: stockReceiptItems.packSize,
    quantity: stockReceiptItems.quantity,
    lotId: stockProvenanceLots.lotId,
    lotCode: stockProvenanceLots.lotCode,
  }).from(stockReceiptItems)
    .innerJoin(stockProvenanceLots, eq(stockProvenanceLots.lotId, stockReceiptItems.lotId))
    .where(eq(stockReceiptItems.receiptId, receiptId))
    .orderBy(asc(stockReceiptItems.sku), asc(stockReceiptItems.type), asc(stockReceiptItems.packSize));
  const groups = await reader.select({ groupId: stockMovementGroups.groupId, referenceLabel: stockMovementGroups.referenceLabel })
    .from(stockMovementGroups).where(and(eq(stockMovementGroups.referenceType, "RECEIPT"), eq(stockMovementGroups.referenceId, receiptId)));
  const groupByItem = new Map(groups.map((group: any) => [group.referenceLabel, group.groupId]));
  return { ...receipt, items: items.map((item: any) => ({ ...item, stockMovementGroupId: groupByItem.get(item.receiptItemId) || null })) };
}

export async function getReceipt(receiptId: string) {
  const result = await loadReceipt(db, receiptId);
  if (!result) throw new PurchasingRuleError("receipt_not_found");
  return result;
}

export async function listReceipts() {
  const rows = await db.select({ receiptId: stockReceipts.receiptId }).from(stockReceipts)
    .where(sql`${stockReceipts.purchaseOrderId} IS NOT NULL`)
    .orderBy(desc(stockReceipts.receivedAt), desc(stockReceipts.receiptId));
  return Promise.all(rows.map((row) => getReceipt(row.receiptId)));
}

async function findReceiptReplay(reader: any, clientRequestId: string, expectedHash: string) {
  const [row] = await reader.select({ id: stockReceipts.receiptId, hash: stockReceipts.sourceRowHash })
    .from(stockReceipts).where(eq(stockReceipts.clientRequestId, clientRequestId));
  if (!row) return null;
  if (row.hash !== expectedHash) throw new PurchasingRuleError("idempotency_payload_mismatch");
  return { ...(await loadReceipt(reader, row.id)), idempotentReplay: true };
}

export async function createReceipt(input: CreateReceiptInput) {
  const clientRequestId = requireUuid(input.clientRequestId, "client_request_id_required");
  const purchaseOrderId = requireUuid(input.purchaseOrderId, "purchase_order_required");
  const destinationLocationId = requireUuid(input.destinationLocationId, "destination_location_required");
  const receivedAt = parseDate(input.receivedAt, "received_at_invalid");
  const author = requireActor(input.author);
  if (!Array.isArray(input.lines) || !input.lines.length) throw new PurchasingRuleError("receipt_lines_required");
  const lines = input.lines.map((line) => {
    const identity = validatePurchaseIdentity(line, line.receivedQuantity, "received_quantity_invalid");
    return { ...identity, purchaseOrderItemId: requireUuid(line.purchaseOrderItemId, "purchase_order_item_required"), receivedQuantity: identity.quantity };
  });
  assertNoDuplicateIdentities(lines);
  if (new Set(lines.map((line) => line.purchaseOrderItemId)).size !== lines.length) throw new PurchasingRuleError("duplicate_purchase_order_item");
  lines.sort((left, right) => { const a = `${identityKey(left)}\u0000${left.purchaseOrderItemId}`; const b = `${identityKey(right)}\u0000${right.purchaseOrderItemId}`; return a < b ? -1 : a > b ? 1 : 0; });
  const normalized = { purchaseOrderId, destinationLocationId, receivedAt: receivedAt.toISOString(), author, invoiceReference: cleanText(input.invoiceReference, 100), shipmentReference: cleanText(input.shipmentReference, 100), notes: cleanText(input.notes, 2000), lines };
  const sourceRowHash = hashPayload(normalized);
  const replay = await findReceiptReplay(db, clientRequestId, sourceRowHash);
  if (replay) return replay;

  try {
    return await db.transaction(async (tx: any) => {
      const [order] = await tx.select().from(stockPurchaseOrders).where(eq(stockPurchaseOrders.purchaseOrderId, purchaseOrderId)).for("update");
      if (!order) throw new PurchasingRuleError("purchase_order_not_found");
      if (["DRAFT", "CANCELLED"].includes(order.status)) throw new PurchasingRuleError("purchase_order_not_receivable");
      const [supplier] = await tx.select().from(stockSuppliers).where(and(eq(stockSuppliers.supplierId, order.supplierId), eq(stockSuppliers.active, true)));
      if (!supplier) throw new PurchasingRuleError("supplier_not_found_or_inactive");
      const [location] = await tx.select().from(stockLocations).where(and(eq(stockLocations.locationId, destinationLocationId), eq(stockLocations.active, true)));
      if (!location) throw new PurchasingRuleError("destination_location_not_found_or_inactive");
      const orderItems = await tx.select().from(stockPurchaseOrderItems).where(eq(stockPurchaseOrderItems.purchaseOrderId, purchaseOrderId));
      const itemById = new Map(orderItems.map((item: any) => [item.purchaseOrderItemId, item]));
      const receivedBefore = await receivedByPurchaseItem(tx, purchaseOrderId);
      for (const line of lines) {
        const item: any = itemById.get(line.purchaseOrderItemId);
        if (!item) throw new PurchasingRuleError("purchase_order_item_not_found");
        if (item.sku !== line.sku || item.type !== line.type || item.packSize !== line.packSize) throw new PurchasingRuleError("purchase_order_item_identity_mismatch");
        const outstanding = item.orderedQuantity - (receivedBefore.get(item.purchaseOrderItemId) || 0);
        if (line.receivedQuantity > outstanding) throw new PurchasingRuleError("over_receipt_blocked", `Quantité reçue ${line.receivedQuantity}, restante ${outstanding}`);
      }

      const receiptId = randomUUID();
      const receiptCode = code("RCT", receiptId);
      await tx.insert(stockReceipts).values({
        receiptId, receiptCode, supplierId: order.supplierId, purchaseOrderId, clientRequestId, sourceRowHash,
        destinationLocationId, purchaseReference: normalized.shipmentReference || order.purchaseReference,
        invoiceReference: normalized.invoiceReference, receivedAt, author, notes: normalized.notes,
      });
      const movementGroupIds: string[] = [];
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const receiptItemId = randomUUID();
        const lotId = randomUUID();
        const lotCode = `LOT-${receiptCode}-${String(index + 1).padStart(2, "0")}`;
        await tx.insert(stockProvenanceLots).values({ lotId, lotCode, originKind: "RECEIPT", receiptId, sourceReference: normalized.invoiceReference || normalized.shipmentReference, isSystem: false });
        await tx.insert(stockReceiptItems).values({ receiptItemId, receiptId, purchaseOrderItemId: line.purchaseOrderItemId, lotId, sku: line.sku, type: line.type, packSize: line.packSize, quantity: line.receivedQuantity });
        const result = await stockStorage.applyLocationMovement({
          sku: line.sku, type: line.type, packSize: line.packSize, movementType: "RECEPTION", qty: line.receivedQuantity,
          destinationLocationId, lotId, author, referenceType: "RECEIPT", referenceId: receiptId,
          referenceLabel: receiptItemId, comment: `Purchase receipt ${receiptCode}`, movementDate: receivedAt,
        }, tx);
        movementGroupIds.push(result.groupId);
      }
      const receivedAfter = new Map(receivedBefore);
      for (const line of lines) receivedAfter.set(line.purchaseOrderItemId, (receivedAfter.get(line.purchaseOrderItemId) || 0) + line.receivedQuantity);
      const allComplete = orderItems.every((item: any) => (receivedAfter.get(item.purchaseOrderItemId) || 0) === item.orderedQuantity);
      await tx.update(stockPurchaseOrders).set({ status: allComplete ? "RECEIVED" : "PARTIALLY_RECEIVED" }).where(eq(stockPurchaseOrders.purchaseOrderId, purchaseOrderId));
      return { ...(await loadReceipt(tx, receiptId)), movementGroupIds, purchaseOrderStatus: allComplete ? "RECEIVED" : "PARTIALLY_RECEIVED", idempotentReplay: false };
    });
  } catch (error) {
    if (databaseCode(error) === "ER_DUP_ENTRY") {
      const concurrent = await findReceiptReplay(db, clientRequestId, sourceRowHash);
      if (concurrent) return concurrent;
    }
    throw error;
  }
}
