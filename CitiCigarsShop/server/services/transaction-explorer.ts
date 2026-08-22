/**
 * Transaction Explorer — a light, filterable read view over
 * orders/order_items/customers, plus an .xlsx export at order_item grain.
 *
 * Explicit non-goals (per brief): no charts, no pivot tables, no BI inside
 * the CRM. This is a filter+export tool; Excel remains the analytical
 * layer. Filters combine as AND only — no logic builder in V1.
 *
 * Extensibility note: every filter here reads from columns that already
 * exist in Phase 1 (orders/order_items/customers). Dimensions not yet
 * captured (e.g. acquisition channel) are deliberately NOT exposed as
 * filters — no fake/empty filter UI. Phase 2 fields (supplier, purchase
 * order, location, landed cost, a VENTE/ACHAT direction) can be added as
 * new optional filter keys later without reshaping this module, since each
 * filter is an independent, optional WHERE clause fragment.
 */
import { and, eq, gte, lte, like, or, sql, desc } from "drizzle-orm";
import { db } from "../db.mysql";
import { customers } from "../../shared/schema.crm";
import { orders, orderItems } from "../../shared/schema.sales";
import * as XLSX from "xlsx";

export interface TransactionExplorerFilters {
  search?: string; // matches customer name, order id, item sku, brand-ish free text (item_sku/custom_label)
  dateFrom?: string; // ISO date
  dateTo?: string; // ISO date
  customerId?: string;
  orderType?: string; // orders.notes / offer label free text match (Phase 1 has no dedicated "order type" column beyond notes)
  itemSku?: string;
  itemType?: string; // PRODUCT | BUNDLE | ACCESSORY | SERVICE | CUSTOM
  city?: string;
  country?: string;
  paymentStatus?: "PAID" | "PARTIAL" | "UNPAID"; // derived from balanceDue vs finalSaleTotalXaf
  minAmountXaf?: number;
  maxAmountXaf?: number;
  hasDiscount?: boolean; // orders.extraCustomerDiscountXaf > 0 OR order_items.allocatedOrderDiscountXaf > 0
  minMarginRate?: number; // 0-1, computed from orders.grossMarginXaf / finalSaleTotalXaf when present
  maxMarginRate?: number;
  hasCostVariance?: boolean; // order_items.costVarianceVsStandardXaf != 0
  hasSrvVal?: boolean; // any line with item_sku = 'CTCG-SRV-VAL'
}

export interface TransactionExplorerRow {
  orderId: string;
  orderDate: Date;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  customerCity: string | null;
  customerCountry: string | null;
  orderNotes: string | null;
  orderItemId: string;
  itemType: string;
  itemSku: string;
  brand: string | null;
  series: string | null;
  vitole: string | null;
  quantity: number;
  actualUnitPriceXaf: number;
  actualLineRevenueXaf: number;
  standardUnitCostXaf: string | null;
  standardLineCostXaf: string | null;
  actualLineCostXaf: string | null;
  costVarianceVsStandardXaf: string | null;
  subtotalRegularTotalXaf: number;
  extraCustomerDiscountXaf: number;
  finalSaleTotalXaf: number;
  amountPaid: number;
  balanceDue: number;
  paymentDate: Date | null;
  /** Derived, not stored — same rule used by the paymentStatus filter. */
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
}

/**
 * Runs the filtered query. Filters combine as AND — deliberately no
 * OR/logic-builder in V1 (per brief).
 */
export async function queryTransactions(filters: TransactionExplorerFilters): Promise<TransactionExplorerRow[]> {
  const conditions = [];

  if (filters.dateFrom) conditions.push(gte(orders.orderDate, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(orders.orderDate, new Date(filters.dateTo)));
  if (filters.customerId) conditions.push(eq(orders.customerId, filters.customerId));
  if (filters.city) conditions.push(eq(customers.city, filters.city));
  if (filters.country) conditions.push(eq(customers.country, filters.country));
  if (filters.itemSku) conditions.push(like(orderItems.itemSku, `%${filters.itemSku}%`));
  if (filters.itemType) conditions.push(eq(orderItems.itemType, filters.itemType as any));
  if (filters.orderType) conditions.push(like(orders.notes, `%${filters.orderType}%`));
  if (filters.minAmountXaf != null) conditions.push(gte(orders.finalSaleTotalXaf, filters.minAmountXaf));
  if (filters.maxAmountXaf != null) conditions.push(lte(orders.finalSaleTotalXaf, filters.maxAmountXaf));
  if (filters.hasSrvVal) conditions.push(eq(orderItems.itemSku, "CTCG-SRV-VAL"));

  if (filters.search) {
    const q = `%${filters.search}%`;
    conditions.push(
      or(
        like(customers.firstName, q),
        like(customers.lastName, q),
        like(orders.orderId, q),
        like(orderItems.itemSku, q),
        like(orderItems.customLabel, q)
      )
    );
  }

  if (filters.hasDiscount) {
    conditions.push(
      or(sql`${orders.extraCustomerDiscountXaf} > 0`, sql`${orderItems.allocatedOrderDiscountXaf} > 0`)
    );
  }

  if (filters.paymentStatus === "PAID") conditions.push(eq(orders.balanceDue, 0));
  if (filters.paymentStatus === "UNPAID") conditions.push(eq(orders.amountPaid, 0));
  if (filters.paymentStatus === "PARTIAL") {
    conditions.push(sql`${orders.amountPaid} > 0 AND ${orders.balanceDue} > 0`);
  }

  if (filters.hasCostVariance) {
    conditions.push(sql`${orderItems.costVarianceVsStandardXaf} IS NOT NULL AND ${orderItems.costVarianceVsStandardXaf} != 0`);
  }

  if (filters.minMarginRate != null) {
    conditions.push(
      sql`${orders.finalSaleTotalXaf} > 0 AND (${orders.grossMarginXaf} / ${orders.finalSaleTotalXaf}) >= ${filters.minMarginRate}`
    );
  }
  if (filters.maxMarginRate != null) {
    conditions.push(
      sql`${orders.finalSaleTotalXaf} > 0 AND (${orders.grossMarginXaf} / ${orders.finalSaleTotalXaf}) <= ${filters.maxMarginRate}`
    );
  }

  const query = db
    .select({
      orderId: orders.orderId,
      orderDate: orders.orderDate,
      customerId: customers.customerId,
      firstName: customers.firstName,
      lastName: customers.lastName,
      customerPhone: customers.phoneWhatsapp,
      customerCity: customers.city,
      customerCountry: customers.country,
      orderNotes: orders.notes,
      orderItemId: orderItems.orderItemId,
      itemType: orderItems.itemType,
      itemSku: orderItems.itemSku,
      brand: orderItems.brand,
      series: orderItems.series,
      vitole: orderItems.vitole,
      customLabel: orderItems.customLabel,
      quantity: orderItems.quantity,
      actualUnitPriceXaf: orderItems.actualUnitPriceXaf,
      actualLineRevenueXaf: orderItems.actualLineRevenueXaf,
      standardUnitCostXaf: orderItems.standardUnitCostXaf,
      standardLineCostXaf: orderItems.standardLineCostXaf,
      actualLineCostXaf: orderItems.actualLineCostXaf,
      costVarianceVsStandardXaf: orderItems.costVarianceVsStandardXaf,
      subtotalRegularTotalXaf: orders.subtotalRegularTotalXaf,
      extraCustomerDiscountXaf: orders.extraCustomerDiscountXaf,
      finalSaleTotalXaf: orders.finalSaleTotalXaf,
      amountPaid: orders.amountPaid,
      balanceDue: orders.balanceDue,
      paymentDate: orders.paymentDate,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.orderId))
    .innerJoin(customers, eq(orders.customerId, customers.customerId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.orderDate));

  const rows = await query;

  return rows.map((r) => ({
    orderId: r.orderId,
    orderDate: r.orderDate,
    customerId: r.customerId,
    customerName: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(),
    customerPhone: r.customerPhone,
    customerCity: r.customerCity,
    customerCountry: r.customerCountry,
    orderNotes: r.orderNotes,
    orderItemId: r.orderItemId,
    itemType: r.itemType,
    itemSku: r.customLabel ? `${r.itemSku} (${r.customLabel})` : r.itemSku,
    brand: r.brand,
    series: r.series,
    vitole: r.vitole,
    quantity: r.quantity,
    actualUnitPriceXaf: r.actualUnitPriceXaf,
    actualLineRevenueXaf: r.actualLineRevenueXaf,
    standardUnitCostXaf: r.standardUnitCostXaf,
    standardLineCostXaf: r.standardLineCostXaf,
    actualLineCostXaf: r.actualLineCostXaf,
    costVarianceVsStandardXaf: r.costVarianceVsStandardXaf,
    subtotalRegularTotalXaf: r.subtotalRegularTotalXaf,
    extraCustomerDiscountXaf: r.extraCustomerDiscountXaf,
    finalSaleTotalXaf: r.finalSaleTotalXaf,
    amountPaid: r.amountPaid,
    balanceDue: r.balanceDue,
    paymentDate: r.paymentDate,
    paymentStatus: r.balanceDue === 0 ? "PAID" : r.amountPaid === 0 ? "UNPAID" : "PARTIAL",
  }));
}

export interface TopProductRow {
  itemSku: string;
  brand: string | null;
  series: string | null;
  vitole: string | null;
  orderCount: number; // nombre de commandes DISTINCTES contenant ce SKU, toutes périodes
}

/**
 * Top produits pour le Dashboard admin — nombre de commandes distinctes par
 * SKU, toutes périodes (décision Claudel, 22 août 2026 : remplace le "14
 * ventes" en dur qui n'était calculé sur rien). Réutilise queryTransactions()
 * telle quelle plutôt que de dupliquer le join orders/order_items/customers
 * — une commande supprimée (deleteManualSale) disparaît donc automatiquement
 * ici aussi, par la même contrainte FK CASCADE qui la retire déjà de
 * l'Explorateur.
 */
export async function getTopProductsByOrderCount(limit = 3): Promise<TopProductRow[]> {
  const rows = await queryTransactions({});
  const bySku = new Map<string, { brand: string | null; series: string | null; vitole: string | null; orderIds: Set<string> }>();
  for (const r of rows) {
    let entry = bySku.get(r.itemSku);
    if (!entry) {
      entry = { brand: r.brand, series: r.series, vitole: r.vitole, orderIds: new Set() };
      bySku.set(r.itemSku, entry);
    }
    entry.orderIds.add(r.orderId);
  }
  return Array.from(bySku.entries())
    .map(([itemSku, e]) => ({ itemSku, brand: e.brand, series: e.series, vitole: e.vitole, orderCount: e.orderIds.size }))
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, limit);
}

const LINE_EXPORT_COLUMNS: Array<{ key: string; header: string }> = [
  { key: "orderId", header: "SALE ID" },
  { key: "orderDate", header: "Date" },
  { key: "customerId", header: "Customer ID" },
  { key: "customerName", header: "Client" },
  { key: "customerPhone", header: "WhatsApp" },
  { key: "customerCity", header: "Ville" },
  { key: "customerCountry", header: "Pays" },
  { key: "orderNotes", header: "Relation commerciale / Type commande" },
  { key: "itemSku", header: "SKU" },
  { key: "itemType", header: "Type item" },
  { key: "brand", header: "Marque" },
  { key: "series", header: "Série / Ligne" },
  { key: "vitole", header: "Vitole" },
  { key: "quantity", header: "Quantité" },
  { key: "actualUnitPriceXaf", header: "CA unitaire alloué" },
  { key: "actualLineRevenueXaf", header: "CA ligne alloué" },
  { key: "standardUnitCostXaf", header: "Coût standard unitaire" },
  { key: "standardLineCostXaf", header: "Coût standard ligne" },
  { key: "actualLineCostXaf", header: "Coût réel ligne" },
  { key: "costVarianceVsStandardXaf", header: "Variance coût réel vs standard" },
  { key: "lineMarginXaf", header: "Marge ligne XAF" },
  { key: "lineMarginRate", header: "Marge ligne %" },
];

function asNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function roundXaf(value: unknown): number | null {
  const n = asNumberOrNull(value);
  return n == null ? null : Math.round(n);
}

function buildLineExport(rows: TransactionExplorerRow[]): Record<string, unknown>[] {
  const moneyKeys = new Set([
    "actualUnitPriceXaf",
    "actualLineRevenueXaf",
    "standardUnitCostXaf",
    "standardLineCostXaf",
    "actualLineCostXaf",
    "costVarianceVsStandardXaf",
    "lineMarginXaf",
  ]);

  return rows.map((r) => {
    const actualCost = asNumberOrNull(r.actualLineCostXaf);
    const lineMarginXaf = actualCost == null ? null : r.actualLineRevenueXaf - actualCost;
    const lineMarginRate =
      lineMarginXaf == null || r.actualLineRevenueXaf === 0
        ? null
        : lineMarginXaf / r.actualLineRevenueXaf;

    const source: Record<string, unknown> = {
      ...r,
      lineMarginXaf,
      lineMarginRate,
    };

    const out: Record<string, unknown> = {};
    for (const col of LINE_EXPORT_COLUMNS) {
      const v = source[col.key];
      out[col.header] = v instanceof Date
        ? v.toISOString().slice(0, 10)
        : moneyKeys.has(col.key)
          ? roundXaf(v)
          : v;
    }
    return out;
  });
}

function buildOrderExport(rows: TransactionExplorerRow[]): Record<string, unknown>[] {
  const grouped = new Map<string, {
    orderId: string;
    orderDate: Date;
    customerId: string;
    customerName: string;
    customerPhone: string | null;
    customerCity: string | null;
    customerCountry: string | null;
    orderNotes: string | null;
    finalSaleTotalXaf: number;
    amountPaid: number;
    balanceDue: number;
    paymentStatus: string;
    lineCount: number;
    itemQuantity: number;
    visibleRevenue: number;
    actualCostTotal: number;
    costsComplete: boolean;
  }>();

  for (const r of rows) {
    let order = grouped.get(r.orderId);
    if (!order) {
      order = {
        orderId: r.orderId,
        orderDate: r.orderDate,
        customerId: r.customerId,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        customerCity: r.customerCity,
        customerCountry: r.customerCountry,
        orderNotes: r.orderNotes,
        finalSaleTotalXaf: r.finalSaleTotalXaf,
        amountPaid: r.amountPaid,
        balanceDue: r.balanceDue,
        paymentStatus: r.paymentStatus,
        lineCount: 0,
        itemQuantity: 0,
        visibleRevenue: 0,
        actualCostTotal: 0,
        costsComplete: true,
      };
      grouped.set(r.orderId, order);
    }

    order.lineCount += 1;
    order.itemQuantity += r.quantity;
    order.visibleRevenue += r.actualLineRevenueXaf;

    const actualCost = asNumberOrNull(r.actualLineCostXaf);
    if (actualCost == null) order.costsComplete = false;
    else order.actualCostTotal += actualCost;
  }

  return Array.from(grouped.values()).map((order) => {
    // If a line-level filter is active, queryTransactions can return only a
    // subset of an order's lines. Never manufacture an order margin from
    // partial costs: only calculate when visible line revenue reconciles to
    // the order's net sale total and every visible line has a sourced cost.
    const revenueComplete = order.visibleRevenue === order.finalSaleTotalXaf;
    const orderCostXaf =
      order.costsComplete && revenueComplete ? order.actualCostTotal : null;
    const marginXaf =
      orderCostXaf == null ? null : order.finalSaleTotalXaf - orderCostXaf;
    const marginRate =
      marginXaf == null || order.finalSaleTotalXaf === 0
        ? null
        : marginXaf / order.finalSaleTotalXaf;

    return {
      "SALE ID": order.orderId,
      "Date": order.orderDate.toISOString().slice(0, 10),
      "Customer ID": order.customerId,
      "Client": order.customerName,
      "WhatsApp": order.customerPhone,
      "Ville": order.customerCity,
      "Pays": order.customerCountry,
      "Relation commerciale / Type commande": order.orderNotes,
      "Nb lignes": order.lineCount,
      "Qté items": order.itemQuantity,
      "Prix net commande": Math.round(order.finalSaleTotalXaf),
      "Encaissé": Math.round(order.amountPaid),
      "Balance": Math.round(order.balanceDue),
      "Statut paiement": order.paymentStatus,
      "Coût réel commande": roundXaf(orderCostXaf),
      "Marge XAF": roundXaf(marginXaf),
      "Marge %": marginRate,
    };
  });
}

/**
 * Builds the .xlsx buffer at the grain selected in the CRM:
 * - orders: one row per SALE ID, no double-counted parent amounts.
 * - lines: one row per order_item, with only line-level monetary fields.
 */
export function buildTransactionExportWorkbook(
  rows: TransactionExplorerRow[],
  viewMode: "orders" | "lines" = "lines"
): Buffer {
  const data = viewMode === "orders" ? buildOrderExport(rows) : buildLineExport(rows);
  const sheetName = viewMode === "orders" ? "Commandes" : "Lignes";
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
