import crypto from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db.mysql";
import { customers } from "../../shared/schema.crm";
import { orders, orderItems } from "../../shared/schema.sales";
import { products } from "../../shared/schema.mysql";
import { STOCK_TYPES, skus, stockLocations, stockMovementLotAllocations, stockMovementGroups, type StockType } from "../../shared/schema.stock";
import { stockStorage } from "../storage.stock";
import { StockRuleViolation } from "./stock-movement-processor";
import { computeOrder, type CatalogLineInput } from "./sales";
import { formatCtcgId, formatOrderItemId, nextSequenceFromExisting } from "./ctcg-id";

export type ManualSaleItemType = "PRODUCT" | "BUNDLE" | "ACCESSORY" | "SERVICE" | "CUSTOM";
export type StockDisposition = "CONSUME" | "NON_STOCK";

export interface ManualSaleLineInput {
  itemType: ManualSaleItemType;
  sku: string;
  label?: string | null;
  quantity: number;
  regularUnitPriceXaf: number;
  promoUnitPriceXaf?: number | null;
  stockDisposition: StockDisposition;
  stockType?: StockType | null;
  stockPackSize?: number | null;
  sourceLocationId?: string | null;
  nonStockReason?: string | null;
}

export interface CreateManualSaleInput {
  clientRequestId: string;
  author: string;
  customerId: string;
  orderDate: string;
  lines: ManualSaleLineInput[];
  extraCustomerDiscountXaf?: number;
  amountPaid?: number;
  paymentDate?: string | null;
  notes?: string | null;
}

interface CleanManualSaleLine extends ManualSaleLineInput {
  label: string | null;
  promoUnitPriceXaf: number | null;
  stockType: StockType | null;
  stockPackSize: number | null;
  sourceLocationId: string | null;
  nonStockReason: string | null;
}

const MANUAL_SALE_SOURCE_SYSTEM = "crm_manual_sale_stock_v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function allocateSaleId(tx: any): Promise<string> {
  const existing = await tx.select({ orderId: orders.orderId }).from(orders);
  return formatCtcgId("SALE", nextSequenceFromExisting(existing.map((row: any) => row.orderId)));
}

function assertFiniteNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} invalide`);
}

function assertPackSize(type: StockType, packSize: number, lineNumber: number) {
  if (!Number.isInteger(packSize) || packSize < 0) throw new Error(`Ligne ${lineNumber}: packSize exact requis`);
  if (type === "Pack" && packSize <= 0) throw new Error(`Ligne ${lineNumber}: un Pack exige un packSize strictement positif`);
  if (type !== "Pack" && packSize !== 0) throw new Error(`Ligne ${lineNumber}: packSize doit être 0 pour ${type}`);
}

/** Pure, focused M7 contract validation. It never infers identity or location. */
export function validateManualSaleLine(line: ManualSaleLineInput, index: number): CleanManualSaleLine {
  const lineNumber = index + 1;
  const itemType = line.itemType;
  const sku = String(line.sku || "").trim();
  const label = line.label?.trim() || null;
  const nonStockReason = line.nonStockReason?.trim() || null;
  if (!["PRODUCT", "BUNDLE", "ACCESSORY", "SERVICE", "CUSTOM"].includes(itemType)) throw new Error(`Ligne ${lineNumber}: type d'article invalide`);
  if (!sku) throw new Error(`Ligne ${lineNumber}: SKU requis`);
  if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error(`Ligne ${lineNumber}: quantité invalide`);
  assertFiniteNonNegative(line.regularUnitPriceXaf, `Ligne ${lineNumber}: prix catalogue`);
  if (line.promoUnitPriceXaf != null) {
    assertFiniteNonNegative(line.promoUnitPriceXaf, `Ligne ${lineNumber}: prix promo`);
    if (line.promoUnitPriceXaf > line.regularUnitPriceXaf) throw new Error(`Ligne ${lineNumber}: le prix promo ne peut pas dépasser le prix catalogue`);
  }
  if (itemType === "BUNDLE") throw new Error(`Ligne ${lineNumber}: les bundles sont bloqués tant que leur décomposition stock exacte n'est pas définie`);

  const consumesStock = itemType === "PRODUCT" || itemType === "ACCESSORY";
  if (consumesStock) {
    if (line.stockDisposition !== "CONSUME") throw new Error(`Ligne ${lineNumber}: ${itemType} doit être explicitement classé CONSUME`);
    if (!line.stockType || !STOCK_TYPES.includes(line.stockType)) throw new Error(`Ligne ${lineNumber}: type de stock exact requis`);
    if (line.stockPackSize == null) throw new Error(`Ligne ${lineNumber}: packSize exact requis`);
    assertPackSize(line.stockType, line.stockPackSize, lineNumber);
    if (itemType === "ACCESSORY" && line.stockType !== "Accessory") throw new Error(`Ligne ${lineNumber}: un accessoire exige le type de stock Accessory`);
    if (itemType === "PRODUCT" && line.stockType === "Accessory") throw new Error(`Ligne ${lineNumber}: un produit cigare ne peut pas consommer le type Accessory`);
    const sourceLocationId = String(line.sourceLocationId || "").trim();
    if (!UUID_RE.test(sourceLocationId)) throw new Error(`Ligne ${lineNumber}: emplacement source explicite requis`);
    const effectivePrice = line.promoUnitPriceXaf ?? line.regularUnitPriceXaf;
    if (effectivePrice <= 0) throw new Error(`Ligne ${lineNumber}: une ligne stock à revenu nul n'est pas une vente éligible`);
    return {
      ...line,
      itemType,
      sku,
      label,
      regularUnitPriceXaf: Math.round(line.regularUnitPriceXaf),
      promoUnitPriceXaf: line.promoUnitPriceXaf == null ? null : Math.round(line.promoUnitPriceXaf),
      stockType: line.stockType,
      stockPackSize: line.stockPackSize,
      sourceLocationId,
      nonStockReason: null,
    };
  }

  if (line.stockDisposition !== "NON_STOCK") throw new Error(`Ligne ${lineNumber}: ${itemType} doit être explicitement classé NON_STOCK`);
  if (!nonStockReason) throw new Error(`Ligne ${lineNumber}: raison NON_STOCK requise`);
  if (line.stockType != null || line.stockPackSize != null || line.sourceLocationId) {
    throw new Error(`Ligne ${lineNumber}: une ligne NON_STOCK ne doit porter aucune identité ou localisation physique`);
  }
  return {
    ...line,
    itemType,
    sku,
    label,
    regularUnitPriceXaf: Math.round(line.regularUnitPriceXaf),
    promoUnitPriceXaf: line.promoUnitPriceXaf == null ? null : Math.round(line.promoUnitPriceXaf),
    stockType: null,
    stockPackSize: null,
    sourceLocationId: null,
    nonStockReason,
  };
}

function requestHash(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function loadReplay(reader: any, clientRequestId: string, expectedHash: string) {
  const [order] = await reader.select().from(orders).where(and(
    eq(orders.sourceSystem, MANUAL_SALE_SOURCE_SYSTEM),
    eq(orders.sourceRecordId, clientRequestId),
  ));
  if (!order) return null;
  if (order.sourceRowHash !== expectedHash) throw new Error("clientRequestId déjà utilisé avec un contenu de vente différent");
  const items = await reader.select({ stockMovementGroupId: orderItems.stockMovementGroupId })
    .from(orderItems).where(eq(orderItems.orderId, order.orderId));
  return {
    orderId: order.orderId,
    customerId: order.customerId,
    orderDate: order.orderDate,
    lineCount: items.length,
    finalSaleTotalXaf: order.finalSaleTotalXaf,
    amountPaid: order.amountPaid,
    balanceDue: order.balanceDue,
    status: order.status,
    movementGroupIds: items.map((item: any) => item.stockMovementGroupId).filter(Boolean),
    idempotentReplay: true,
  };
}

function databaseCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  if ("code" in error) return String((error as any).code);
  if ("cause" in error) return databaseCode((error as any).cause);
  return "";
}

export interface SaleCompensationAllocation {
  lotId: string;
  locationId: string;
  balanceField: string;
  qtyDelta: number;
  sku: string;
  type: StockType;
  packSize: number;
}

export function planSaleCompensationLegs(
  line: { orderItemId: string; sku: string; stockType: StockType; stockPackSize: number },
  allocations: SaleCompensationAllocation[],
) {
  const physical = allocations
    .filter((row) => row.balanceField === "onHand" && row.qtyDelta < 0)
    .sort((a, b) => `${a.locationId}\0${a.lotId}`.localeCompare(`${b.locationId}\0${b.lotId}`));

  if (!physical.length) throw new Error(`Ligne ${line.orderItemId}: allocations physiques de vente introuvables`);

  return physical.map((allocation) => {
    if (allocation.sku !== line.sku || allocation.type !== line.stockType || allocation.packSize !== line.stockPackSize) {
      throw new Error(`Ligne ${line.orderItemId}: identité allocation/vente incohérente`);
    }
    return {
      sku: allocation.sku,
      type: allocation.type,
      packSize: allocation.packSize,
      quantity: -allocation.qtyDelta,
      destinationLocationId: allocation.locationId,
      lotId: allocation.lotId,
    };
  });
}

export async function deleteManualSale(_orderId: string) {
  throw new Error("Suppression destructive désactivée: utiliser l'annulation compensatoire");
}

export async function cancelManualSale(orderId: string, author: string) {
  const actor = String(author || "").trim();
  if (!actor || actor.length > 100) throw new Error("Auteur opérateur requis (100 caractères maximum)");

  return db.transaction(async (tx: any) => {
    const [order] = await tx.select().from(orders).where(eq(orders.orderId, orderId)).for("update");
    if (!order) throw new Error("Vente introuvable");
    if (order.source !== "manual") throw new Error("Seules les ventes manuelles sont annulables par CLOSE-04");
    if (order.status === "CANCELLED") {
      const existing = await tx.select({ groupId: stockMovementGroups.groupId })
        .from(stockMovementGroups)
        .where(and(eq(stockMovementGroups.movementType, "ANNULATION_VENTE"), eq(stockMovementGroups.referenceId, orderId)));
      return { orderId, status: "CANCELLED", movementGroupIds: existing.map((row: any) => row.groupId), idempotentReplay: true };
    }
    if (Number(order.amountPaid || 0) > 0) {
      throw new Error("Vente encaissée: remboursement/cash reversal requis dans CLOSE-05 avant annulation");
    }

    const lines = await tx.select({
      orderItemId: orderItems.orderItemId,
      sku: orderItems.itemSku,
      stockType: orderItems.stockType,
      stockPackSize: orderItems.stockPackSize,
      stockMovementGroupId: orderItems.stockMovementGroupId,
      stockDisposition: orderItems.stockDisposition,
    }).from(orderItems).where(eq(orderItems.orderId, orderId));

    const movementGroupIds: string[] = [];
    for (const line of lines) {
      if (line.stockDisposition !== "CONSUME") continue;
      if (!line.stockMovementGroupId || !line.stockType || line.stockPackSize == null) {
        throw new Error(`Ligne ${line.orderItemId}: lien Stock Central incomplet`);
      }

      const allocations = await tx.select({
        lotId: stockMovementLotAllocations.lotId,
        locationId: stockMovementLotAllocations.locationId,
        balanceField: stockMovementLotAllocations.balanceField,
        qtyDelta: stockMovementLotAllocations.qtyDelta,
        sku: stockMovementLotAllocations.sku,
        type: stockMovementLotAllocations.type,
        packSize: stockMovementLotAllocations.packSize,
      }).from(stockMovementLotAllocations)
        .where(eq(stockMovementLotAllocations.groupId, line.stockMovementGroupId));

      const compensationLegs = planSaleCompensationLegs({
        orderItemId: line.orderItemId,
        sku: line.sku,
        stockType: line.stockType,
        stockPackSize: line.stockPackSize,
      }, allocations as SaleCompensationAllocation[]);

      for (const allocation of compensationLegs) {
        const result = await stockStorage.applyLocationMovement({
          sku: allocation.sku,
          type: allocation.type,
          packSize: allocation.packSize,
          movementType: "ANNULATION_VENTE",
          qty: allocation.quantity,
          destinationLocationId: allocation.destinationLocationId,
          lotId: allocation.lotId,
          author: actor,
          referenceType: "ORDER",
          referenceId: orderId,
          referenceLabel: line.orderItemId,
          comment: `Compensation append-only de vente ${orderId} / ${line.orderItemId}`,
          movementDate: new Date(),
        }, tx);
        movementGroupIds.push(result.groupId);
      }
    }

    await tx.update(orders).set({ status: "CANCELLED" }).where(eq(orders.orderId, orderId));
    return { orderId, status: "CANCELLED", movementGroupIds, idempotentReplay: false };
  });
}

/** Stock decrements only when this new manual order commits as CONFIRMED/PAID. */
export async function createManualSale(input: CreateManualSaleInput) {
  const clientRequestId = String(input.clientRequestId || "").trim();
  const author = String(input.author || "").trim();
  if (!UUID_RE.test(clientRequestId)) throw new Error("clientRequestId UUID requis pour l'idempotence");
  if (!author || author.length > 100) throw new Error("Auteur opérateur requis (100 caractères maximum)");
  if (!input.customerId) throw new Error("Client requis");
  if (!input.orderDate) throw new Error("Date de vente requise");
  if (!Array.isArray(input.lines) || input.lines.length === 0) throw new Error("Au moins une ligne est requise");
  const orderDate = new Date(input.orderDate);
  if (Number.isNaN(orderDate.getTime())) throw new Error("Date de vente invalide");
  const cleanLines = input.lines.map(validateManualSaleLine);
  const extraCustomerDiscountXaf = Math.round(input.extraCustomerDiscountXaf || 0);
  const amountPaidInput = Math.round(input.amountPaid || 0);
  assertFiniteNonNegative(extraCustomerDiscountXaf, "Remise commande");
  assertFiniteNonNegative(amountPaidInput, "Montant encaissé");
  const computed = computeOrder(cleanLines.map<CatalogLineInput>((line) => ({
    itemType: line.itemType,
    sku: line.sku,
    quantity: line.quantity,
    regularUnitPriceXaf: line.regularUnitPriceXaf,
    promoUnitPriceXaf: line.promoUnitPriceXaf,
  })), extraCustomerDiscountXaf);
  if (amountPaidInput > computed.finalSaleTotalXaf) throw new Error("Le montant encaissé ne peut pas dépasser le net de la commande");
  const normalizedPaymentDate = amountPaidInput > 0 ? new Date(input.paymentDate || input.orderDate) : null;
  if (normalizedPaymentDate && Number.isNaN(normalizedPaymentDate.getTime())) throw new Error("Date d'encaissement invalide");
  const payloadHash = requestHash({
    customerId: input.customerId,
    orderDate: orderDate.toISOString(),
    lines: cleanLines,
    extraCustomerDiscountXaf,
    amountPaid: amountPaidInput,
    paymentDate: normalizedPaymentDate?.toISOString() || null,
    notes: input.notes?.trim() || null,
    author,
  });
  const replay = await loadReplay(db, clientRequestId, payloadHash);
  if (replay) return replay;

  try {
    return await db.transaction(async (tx: any) => {
      const replayInsideTransaction = await loadReplay(tx, clientRequestId, payloadHash);
      if (replayInsideTransaction) return replayInsideTransaction;
      const [customer] = await tx.select({ customerId: customers.customerId, isBlacklisted: customers.isBlacklisted })
        .from(customers).where(eq(customers.customerId, input.customerId));
      if (!customer) throw new Error("Client introuvable");
      if (customer.isBlacklisted) throw new Error("Vente impossible : ce client est actuellement blacklisté");

      // Validate every external stock fact before the first ledger mutation.
      const consumingLines = cleanLines.filter((line) => line.stockDisposition === "CONSUME");
      const stockSkus = Array.from(new Set(consumingLines.map((line) => line.sku)));
      const sourceIds = Array.from(new Set(consumingLines.map((line) => line.sourceLocationId!)));
      const knownSkus = stockSkus.length ? await tx.select({ sku: skus.sku }).from(skus).where(inArray(skus.sku, stockSkus)) : [];
      const activeLocations = sourceIds.length ? await tx.select({ locationId: stockLocations.locationId }).from(stockLocations)
        .where(and(inArray(stockLocations.locationId, sourceIds), eq(stockLocations.active, true))) : [];
      const knownSkuSet = new Set(knownSkus.map((row: any) => row.sku));
      const activeLocationSet = new Set(activeLocations.map((row: any) => row.locationId));
      consumingLines.forEach((line, index) => {
        if (!knownSkuSet.has(line.sku)) throw new Error(`Ligne ${index + 1}: SKU stock introuvable (${line.sku})`);
        if (!activeLocationSet.has(line.sourceLocationId!)) throw new Error(`Ligne ${index + 1}: emplacement source introuvable ou inactif`);
      });

      const orderId = await allocateSaleId(tx);
      const amountPaid = amountPaidInput;
      const balanceDue = computed.finalSaleTotalXaf - amountPaid;
      const status = balanceDue === 0 ? "PAID" : "CONFIRMED";
      await tx.insert(orders).values({
        orderId,
        customerId: input.customerId,
        orderDate,
        status,
        currency: "XAF",
        subtotalRegularTotalXaf: computed.subtotalRegularTotalXaf,
        productDiscountsTotalXaf: computed.productDiscountsTotalXaf,
        subtotalAfterDiscountsXaf: computed.subtotalAfterDiscountsXaf,
        extraCustomerDiscountXaf: computed.extraCustomerDiscountXaf,
        finalSaleTotalXaf: computed.finalSaleTotalXaf,
        totalCostXaf: null,
        grossMarginXaf: null,
        grossMarginRate: null,
        amountPaid,
        balanceDue,
        paymentDate: normalizedPaymentDate,
        source: "manual",
        sourceSystem: MANUAL_SALE_SOURCE_SYSTEM,
        sourceRecordId: clientRequestId,
        sourceRowHash: payloadHash,
        notes: input.notes?.trim() || null,
      } as any);

      const lineRecords: Array<{ orderItemId: string; source: CleanManualSaleLine }> = [];
      for (let index = 0; index < computed.items.length; index += 1) {
        const item = computed.items[index];
        const source = cleanLines[index];
        const orderItemId = formatOrderItemId(orderId, index + 1);
        let brand: string | null = null;
        let series: string | null = null;
        let vitole: string | null = null;
        let customLabel: string | null = source.label;
        if (item.itemType === "PRODUCT") {
          const [product] = await tx.select({ marque: products.marque, ligne: products.ligne, vitole: products.vitole })
            .from(products).where(eq(products.sku, item.itemSku));
          if (product) {
            brand = product.marque;
            series = product.ligne;
            vitole = product.vitole;
            customLabel = null;
          }
        }
        await tx.insert(orderItems).values({
          orderItemId,
          orderId,
          itemType: item.itemType,
          itemSku: item.itemSku,
          brand,
          series,
          vitole,
          customLabel,
          quantity: item.quantity,
          regularUnitPriceXaf: item.regularUnitPriceXaf,
          promoUnitPriceXaf: item.promoUnitPriceXaf,
          effectiveUnitPriceXaf: item.effectiveUnitPriceXaf,
          lineSubtotalXaf: item.lineSubtotalXaf,
          allocatedOrderDiscountXaf: item.allocatedOrderDiscountXaf,
          actualLineRevenueXaf: item.actualLineRevenueXaf,
          actualUnitPriceXaf: item.actualUnitPriceXaf,
          standardUnitCostXaf: null,
          standardLineCostXaf: null,
          actualLineCostXaf: null,
          costVarianceVsStandardXaf: null,
          unitCostAtSaleXaf: null,
          totalCostXaf: null,
          lineMarginXaf: null,
          marginRate: null,
          stockDisposition: source.stockDisposition,
          stockType: source.stockType,
          stockPackSize: source.stockPackSize,
          stockSourceLocationId: source.sourceLocationId,
          stockNonConsumptionReason: source.nonStockReason,
        } as any);
        lineRecords.push({ orderItemId, source });
      }

      // A global stable order prevents reversed multi-line orders from taking
      // aggregate/location/lot locks in conflicting identity order.
      const stockLines = lineRecords.filter((line) => line.source.stockDisposition === "CONSUME")
        .sort((left, right) => {
          const leftKey = [left.source.sku, left.source.stockType, String(left.source.stockPackSize).padStart(10, "0"), left.source.sourceLocationId, left.orderItemId].join("\u0000");
          const rightKey = [right.source.sku, right.source.stockType, String(right.source.stockPackSize).padStart(10, "0"), right.source.sourceLocationId, right.orderItemId].join("\u0000");
          return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
        });
      const movementGroupIds: string[] = [];
      for (const line of stockLines) {
        let result;
        try {
          result = await stockStorage.applyLocationMovement({
            sku: line.source.sku,
            type: line.source.stockType!,
            packSize: line.source.stockPackSize!,
            movementType: "VENTE",
            qty: line.source.quantity,
            sourceLocationId: line.source.sourceLocationId!,
            author,
            referenceType: "ORDER",
            referenceId: orderId,
            referenceLabel: line.orderItemId,
            comment: `CRM sale line ${line.orderItemId}`,
            movementDate: orderDate,
          }, tx);
        } catch (error) {
          if (error instanceof StockRuleViolation && error.code.startsWith("insufficient_")) {
            throw new Error(`Stock insuffisant pour ${line.source.sku} / ${line.source.stockType} / pack ${line.source.stockPackSize} au lieu sélectionné`);
          }
          throw error;
        }
        await tx.update(orderItems).set({ stockMovementGroupId: result.groupId }).where(eq(orderItems.orderItemId, line.orderItemId));
        movementGroupIds.push(result.groupId);
      }
      await tx.update(customers).set({ status: "CUSTOMER" }).where(eq(customers.customerId, input.customerId));
      return {
        orderId,
        customerId: input.customerId,
        orderDate,
        lineCount: computed.items.length,
        finalSaleTotalXaf: computed.finalSaleTotalXaf,
        amountPaid,
        balanceDue,
        status,
        movementGroupIds,
        idempotentReplay: false,
      };
    });
  } catch (error) {
    if (databaseCode(error) === "ER_DUP_ENTRY") {
      const concurrentReplay = await loadReplay(db, clientRequestId, payloadHash);
      if (concurrentReplay) return concurrentReplay;
    }
    throw error;
  }
}
