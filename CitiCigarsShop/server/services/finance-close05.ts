import { randomUUID } from "crypto";
import { and, eq, gte, lt, ne, sql } from "drizzle-orm";
import { db } from "../db.mysql";
import { cashJournalEntries, orders, orderItems } from "../../shared/schema.sales";
import { stockLotCostBasis, stockMovementLotAllocations } from "../../shared/schema.stock";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CashEntryType = "RECEIPT" | "REFUND";

export function signedCashAmount(entryType: CashEntryType, amountXaf: number) {
  if (!Number.isInteger(amountXaf) || amountXaf <= 0) throw new Error("Montant de caisse XAF entier positif requis");
  return entryType === "RECEIPT" ? amountXaf : -amountXaf;
}

export function netCashBalance(entries: Array<{ entryType: CashEntryType; amountXaf: number }>) {
  return entries.reduce((sum, entry) => sum + signedCashAmount(entry.entryType, entry.amountXaf), 0);
}


export function assertCashClearedForCancellation(
  orderAmountPaid: number,
  entries: Array<{ entryType: CashEntryType; amountXaf: number }>,
) {
  if (orderAmountPaid > 0 && entries.length === 0) {
    throw new Error("Vente encaissée legacy: journal de caisse absent, rapprochement manuel requis");
  }
  const balanceXaf = netCashBalance(entries);
  if (balanceXaf !== 0) {
    throw new Error("Vente encaissée: remboursement append-only requis avant annulation");
  }
  return balanceXaf;
}

export async function appendCashEntry(
  exec: DbOrTx,
  input: {
    orderId: string;
    entryType: CashEntryType;
    amountXaf: number;
    occurredAt: Date;
    author: string;
    reference: string;
    note?: string | null;
  },
) {
  const author = String(input.author || "").trim();
  const reference = String(input.reference || "").trim();
  if (!author || author.length > 100) throw new Error("Auteur caisse requis");
  if (!reference || reference.length > 255) throw new Error("Référence caisse requise");
  signedCashAmount(input.entryType, input.amountXaf);
  if (!(input.occurredAt instanceof Date) || Number.isNaN(input.occurredAt.getTime())) throw new Error("Date caisse invalide");

  const [existing] = await exec.select().from(cashJournalEntries).where(eq(cashJournalEntries.reference, reference));
  if (existing) {
    if (
      existing.orderId !== input.orderId ||
      existing.entryType !== input.entryType ||
      existing.amountXaf !== input.amountXaf ||
      existing.author !== author
    ) {
      throw new Error("Référence caisse déjà utilisée avec un contenu différent");
    }
    return { entry: existing, idempotentReplay: true };
  }

  const cashEntryId = randomUUID();
  await exec.insert(cashJournalEntries).values({
    cashEntryId,
    orderId: input.orderId,
    entryType: input.entryType,
    amountXaf: input.amountXaf,
    occurredAt: input.occurredAt,
    author,
    reference,
    note: input.note?.trim() || null,
  });
  const [entry] = await exec.select().from(cashJournalEntries).where(eq(cashJournalEntries.cashEntryId, cashEntryId));
  return { entry, idempotentReplay: false };
}

export async function orderCashState(exec: DbOrTx, orderId: string) {
  const entries = await exec.select().from(cashJournalEntries)
    .where(eq(cashJournalEntries.orderId, orderId));
  const balanceXaf = netCashBalance(entries.map((entry) => ({
    entryType: entry.entryType,
    amountXaf: entry.amountXaf,
  })));
  return { entries, balanceXaf };
}

export type CogsAllocation = {
  lotId: string;
  sku: string;
  type: "Box" | "Pack" | "Loose" | "Accessory";
  packSize: number;
  qtyDelta: number;
  balanceField: string;
};

export type CostBasisRow = {
  lotId: string;
  sku: string;
  type: "Box" | "Pack" | "Loose" | "Accessory";
  packSize: number;
  unitCostXaf: string | number;
};

function basisKey(value: { lotId: string; sku: string; type: string; packSize: number }) {
  return [value.lotId, value.sku, value.type, value.packSize].join("\u0000");
}

export function calculateFifoCogs(
  allocations: CogsAllocation[],
  bases: CostBasisRow[],
): { known: true; totalCostXaf: number; quantity: number; weightedUnitCostXaf: number } |
   { known: false; missing: Array<{ lotId: string; sku: string; type: string; packSize: number }> } {
  const physical = allocations.filter((row) => row.balanceField === "onHand" && row.qtyDelta < 0);
  const basisByKey = new Map(bases.map((row) => [basisKey(row), Number(row.unitCostXaf)]));
  const missing: Array<{ lotId: string; sku: string; type: string; packSize: number }> = [];
  let exactTotal = 0;
  let quantity = 0;

  for (const allocation of physical) {
    const unitCost = basisByKey.get(basisKey(allocation));
    if (unitCost == null || !Number.isFinite(unitCost) || unitCost < 0) {
      missing.push({ lotId: allocation.lotId, sku: allocation.sku, type: allocation.type, packSize: allocation.packSize });
      continue;
    }
    const qty = -allocation.qtyDelta;
    exactTotal += qty * unitCost;
    quantity += qty;
  }

  if (missing.length) return { known: false, missing };
  if (!physical.length || quantity <= 0) return { known: false, missing: [] };
  const totalCostXaf = Math.round(exactTotal);
  return {
    known: true,
    totalCostXaf,
    quantity,
    weightedUnitCostXaf: Math.round((exactTotal / quantity) * 10_000) / 10_000,
  };
}


export function calculateGrossMargin(revenueXaf: number, cogsXaf: number) {
  if (!Number.isInteger(revenueXaf) || !Number.isInteger(cogsXaf) || revenueXaf < 0 || cogsXaf < 0) {
    throw new Error("Montants marge invalides");
  }
  const grossMarginXaf = revenueXaf - cogsXaf;
  const grossMarginRate = revenueXaf === 0 ? null : grossMarginXaf / revenueXaf;
  return { grossMarginXaf, grossMarginRate };
}

export async function finalizeOrderCogsAndMargin(exec: DbOrTx, orderId: string) {
  const lines = await exec.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  let orderCost = 0;
  let complete = true;

  for (const line of lines) {
    if (line.stockDisposition !== "CONSUME") {
      complete = false;
      continue;
    }
    if (!line.stockMovementGroupId) {
      complete = false;
      continue;
    }

    const allocations = await exec.select({
      lotId: stockMovementLotAllocations.lotId,
      sku: stockMovementLotAllocations.sku,
      type: stockMovementLotAllocations.type,
      packSize: stockMovementLotAllocations.packSize,
      qtyDelta: stockMovementLotAllocations.qtyDelta,
      balanceField: stockMovementLotAllocations.balanceField,
    }).from(stockMovementLotAllocations)
      .where(eq(stockMovementLotAllocations.groupId, line.stockMovementGroupId));

    const bases = await Promise.all(
      allocations.filter((a) => a.balanceField === "onHand" && a.qtyDelta < 0).map(async (a) => {
        const [basis] = await exec.select().from(stockLotCostBasis).where(and(
          eq(stockLotCostBasis.lotId, a.lotId),
          eq(stockLotCostBasis.sku, a.sku),
          eq(stockLotCostBasis.type, a.type),
          eq(stockLotCostBasis.packSize, a.packSize),
        ));
        return basis;
      }),
    );

    const result = calculateFifoCogs(allocations as CogsAllocation[], bases.filter(Boolean) as CostBasisRow[]);
    if (!result.known) {
      complete = false;
      continue;
    }

    const lineMargin = calculateGrossMargin(line.actualLineRevenueXaf, result.totalCostXaf);
    const lineMarginXaf = lineMargin.grossMarginXaf;
    const marginRate = lineMargin.grossMarginRate;
    await exec.update(orderItems).set({
      unitCostAtSaleXaf: Math.round(result.weightedUnitCostXaf),
      totalCostXaf: result.totalCostXaf,
      lineMarginXaf,
      marginRate: marginRate == null ? null : String(marginRate.toFixed(4)),
    }).where(eq(orderItems.orderItemId, line.orderItemId));
    orderCost += result.totalCostXaf;
  }

  const [order] = await exec.select().from(orders).where(eq(orders.orderId, orderId));
  if (!order) throw new Error("Vente introuvable pendant calcul COGS");

  if (!complete) {
    await exec.update(orders).set({
      totalCostXaf: null,
      grossMarginXaf: null,
      grossMarginRate: null,
    }).where(eq(orders.orderId, orderId));
    return { known: false as const };
  }

  const orderMargin = calculateGrossMargin(order.finalSaleTotalXaf, orderCost);
  const grossMarginXaf = orderMargin.grossMarginXaf;
  const grossMarginRate = orderMargin.grossMarginRate;
  await exec.update(orders).set({
    totalCostXaf: orderCost,
    grossMarginXaf,
    grossMarginRate: grossMarginRate == null ? null : String(grossMarginRate.toFixed(4)),
  }).where(eq(orders.orderId, orderId));
  return { known: true as const, totalCostXaf: orderCost, grossMarginXaf, grossMarginRate };
}

export async function grossMarginSummary(from: Date, to: Date) {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) throw new Error("Période invalide");
  const [summary] = await db.select({
    salesCount: sql<number>`COUNT(*)`,
    knownMarginCount: sql<number>`SUM(CASE WHEN ${orders.totalCostXaf} IS NOT NULL THEN 1 ELSE 0 END)`,
    totalRevenueXaf: sql<number>`COALESCE(SUM(${orders.finalSaleTotalXaf}), 0)`,
    knownRevenueXaf: sql<number>`COALESCE(SUM(CASE WHEN ${orders.totalCostXaf} IS NOT NULL THEN ${orders.finalSaleTotalXaf} ELSE 0 END), 0)`,
    cogsXaf: sql<number>`COALESCE(SUM(CASE WHEN ${orders.totalCostXaf} IS NOT NULL THEN ${orders.totalCostXaf} ELSE 0 END), 0)`,
    grossMarginXaf: sql<number>`COALESCE(SUM(CASE WHEN ${orders.grossMarginXaf} IS NOT NULL THEN ${orders.grossMarginXaf} ELSE 0 END), 0)`,
  }).from(orders).where(and(
    gte(orders.orderDate, from),
    lt(orders.orderDate, to),
    ne(orders.status, "CANCELLED"),
  ));
  return {
    ...summary,
    salesCount: Number(summary?.salesCount ?? 0),
    knownMarginCount: Number(summary?.knownMarginCount ?? 0),
    incompleteSalesCount: Number(summary?.salesCount ?? 0) - Number(summary?.knownMarginCount ?? 0),
    totalRevenueXaf: Number(summary?.totalRevenueXaf ?? 0),
    knownRevenueXaf: Number(summary?.knownRevenueXaf ?? 0),
    cogsXaf: Number(summary?.cogsXaf ?? 0),
    grossMarginXaf: Number(summary?.grossMarginXaf ?? 0),
  };
}
