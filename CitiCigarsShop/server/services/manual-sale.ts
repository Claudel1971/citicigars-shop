import { eq } from "drizzle-orm";
import { db } from "../db.mysql";
import { customers } from "../../shared/schema.crm";
import { orders, orderItems } from "../../shared/schema.sales";
import { products } from "../../shared/schema.mysql";
import { bundles } from "../../shared/schema.bundles";
import { computeOrder, type CatalogLineInput } from "./sales";
import { formatCtcgId, formatOrderItemId, nextSequenceFromExisting } from "./ctcg-id";

export type ManualSaleItemType = "PRODUCT" | "BUNDLE" | "ACCESSORY" | "SERVICE" | "CUSTOM";

export interface ManualSaleLineInput {
  itemType: ManualSaleItemType;
  sku: string;
  label?: string | null;
  quantity: number;
  regularUnitPriceXaf: number;
  promoUnitPriceXaf?: number | null;
}

export interface CreateManualSaleInput {
  customerId: string;
  orderDate: string;
  lines: ManualSaleLineInput[];
  extraCustomerDiscountXaf?: number;
  amountPaid?: number;
  paymentDate?: string | null;
  notes?: string | null;
}

async function allocateSaleId(tx: any): Promise<string> {
  const existing = await tx.select({ orderId: orders.orderId }).from(orders);
  return formatCtcgId("SALE", nextSequenceFromExisting(existing.map((r: any) => r.orderId)));
}

function assertFiniteNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} invalide`);
}

/**
 * Creates a manual CRM sale at the order + order_item grain.
 *
 * Important Phase-1 boundary: this records the commercial transaction only.
 * It deliberately does NOT create Stock Central movements yet, because the
 * sale form does not currently capture the physical stock bucket (Box/Pack/
 * Loose/Accessory) required to decrement stock without guessing.
 */
export async function deleteManualSale(orderId: string) {
  const [order] = await db
    .select({
      orderId: orders.orderId,
      source: orders.source,
    })
    .from(orders)
    .where(eq(orders.orderId, orderId));

  if (!order) throw new Error("Vente introuvable");
  if (order.source !== "manual") {
    throw new Error("Seules les ventes saisies manuellement peuvent être supprimées");
  }

  await db.delete(orders).where(eq(orders.orderId, orderId));
  return { deleted: true };
}

export async function createManualSale(input: CreateManualSaleInput) {
  if (!input.customerId) throw new Error("Client requis");
  if (!input.orderDate) throw new Error("Date de vente requise");
  if (!Array.isArray(input.lines) || input.lines.length === 0) throw new Error("Au moins une ligne est requise");

  const orderDate = new Date(input.orderDate);
  if (Number.isNaN(orderDate.getTime())) throw new Error("Date de vente invalide");

  const cleanLines: ManualSaleLineInput[] = input.lines.map((line, idx) => {
    const sku = String(line.sku || "").trim();
    if (!sku) throw new Error(`Ligne ${idx + 1}: SKU requis`);
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error(`Ligne ${idx + 1}: quantité invalide`);
    assertFiniteNonNegative(line.regularUnitPriceXaf, `Ligne ${idx + 1}: prix catalogue`);
    if (line.promoUnitPriceXaf != null) {
      assertFiniteNonNegative(line.promoUnitPriceXaf, `Ligne ${idx + 1}: prix promo`);
      if (line.promoUnitPriceXaf > line.regularUnitPriceXaf) {
        throw new Error(`Ligne ${idx + 1}: le prix promo ne peut pas dépasser le prix catalogue`);
      }
    }
    return {
      ...line,
      sku,
      label: line.label?.trim() || null,
      regularUnitPriceXaf: Math.round(line.regularUnitPriceXaf),
      promoUnitPriceXaf: line.promoUnitPriceXaf == null ? null : Math.round(line.promoUnitPriceXaf),
    };
  });

  const extraCustomerDiscountXaf = Math.round(input.extraCustomerDiscountXaf || 0);
  const amountPaidInput = Math.round(input.amountPaid || 0);
  assertFiniteNonNegative(extraCustomerDiscountXaf, "Remise commande");
  assertFiniteNonNegative(amountPaidInput, "Montant encaissé");

  const computed = computeOrder(
    cleanLines.map<CatalogLineInput>((line) => ({
      itemType: line.itemType,
      sku: line.sku,
      quantity: line.quantity,
      regularUnitPriceXaf: line.regularUnitPriceXaf,
      promoUnitPriceXaf: line.promoUnitPriceXaf ?? null,
    })),
    extraCustomerDiscountXaf
  );

  if (amountPaidInput > computed.finalSaleTotalXaf) {
    throw new Error("Le montant encaissé ne peut pas dépasser le net de la commande");
  }

  return db.transaction(async (tx: any) => {
    const [customer] = await tx
      .select({
        customerId: customers.customerId,
        isBlacklisted: customers.isBlacklisted,
      })
      .from(customers)
      .where(eq(customers.customerId, input.customerId));

    if (!customer) throw new Error("Client introuvable");
    if (customer.isBlacklisted) {
      throw new Error("Vente impossible : ce client est actuellement blacklisté");
    }

    const orderId = await allocateSaleId(tx);
    const amountPaid = amountPaidInput;
    const balanceDue = computed.finalSaleTotalXaf - amountPaid;
    const paymentDate = amountPaid > 0
      ? new Date(input.paymentDate || input.orderDate)
      : null;

    await tx.insert(orders).values({
      orderId,
      customerId: input.customerId,
      orderDate,
      status: balanceDue === 0 ? "PAID" : "CONFIRMED",
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
      paymentDate,
      source: "manual",
      notes: input.notes?.trim() || null,
    } as any);

    for (let i = 0; i < computed.items.length; i += 1) {
      const item = computed.items[i];
      const source = cleanLines[i];
      let brand: string | null = null;
      let series: string | null = null;
      let vitole: string | null = null;
      let customLabel: string | null = source.label || null;

      if (item.itemType === "PRODUCT") {
        const [product] = await tx
          .select({ marque: products.marque, ligne: products.ligne, vitole: products.vitole })
          .from(products)
          .where(eq(products.sku, item.itemSku));
        if (product) {
          brand = product.marque;
          series = product.ligne;
          vitole = product.vitole;
          customLabel = null;
        }
      } else if (item.itemType === "BUNDLE") {
        const [bundle] = await tx.select({ nom: bundles.nom }).from(bundles).where(eq(bundles.sku, item.itemSku));
        customLabel = source.label || bundle?.nom || null;
      }

      await tx.insert(orderItems).values({
        orderItemId: formatOrderItemId(orderId, i + 1),
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
      } as any);
    }

    // A prospect/qualified lead who buys becomes a CUSTOMER. Do not revive
    // LOST/DORMANT automatically through any other inference — the sale itself
    // is the explicit business event that justifies this transition.
    await tx.update(customers).set({ status: "CUSTOMER" }).where(eq(customers.customerId, input.customerId));

    return {
      orderId,
      customerId: input.customerId,
      orderDate,
      lineCount: computed.items.length,
      finalSaleTotalXaf: computed.finalSaleTotalXaf,
      amountPaid,
      balanceDue,
      status: balanceDue === 0 ? "PAID" : "CONFIRMED",
    };
  });
}
