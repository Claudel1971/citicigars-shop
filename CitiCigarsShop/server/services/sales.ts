/**
 * Sales calculation engine.
 *
 * Implements the mandatory calculation order from the brief (section 7):
 *   1. prix catalogue régulier
 *   2. promotion produit éventuelle
 *   3. sous-total après promotions
 *   4. remise supplémentaire accordée sur la commande au client
 *   5. allocation proportionnelle de cette remise à toutes les lignes
 *   6. revenu réel par ligne
 *   7. coût au CMP historique (Phase 2 — left null here)
 *   8. marge réelle (Phase 2 — left null here)
 *
 * Phase 1 note: unit_cost_at_sale_xaf / total_cost_xaf / line_margin_xaf are
 * intentionally left null by this module. Phase 2 (CMP/landed cost) will
 * populate them without ever changing actual_line_revenue_xaf retroactively.
 *
 * Bundle handling: a bundle is sold as ONE order_item (item_type='BUNDLE'),
 * but its composition is snapshotted into order_item_components at the
 * moment of sale — never recomputed later from the live bundle_items table.
 */

export interface CatalogLineInput {
  itemType: "PRODUCT" | "BUNDLE" | "ACCESSORY" | "SERVICE" | "CUSTOM";
  sku: string; // generic item_sku — no longer split by catalogue family
  quantity: number;
  regularUnitPriceXaf: number;
  promoUnitPriceXaf?: number | null; // if the product/bundle has an active promo
}

export interface BundleComposition {
  productSku: string;
  quantityPerBundle: number;
}

export interface ComputedOrderItem {
  itemType: "PRODUCT" | "BUNDLE" | "ACCESSORY" | "SERVICE" | "CUSTOM";
  itemSku: string;
  quantity: number;
  regularUnitPriceXaf: number;
  promoUnitPriceXaf: number | null;
  effectiveUnitPriceXaf: number;
  lineSubtotalXaf: number;
  allocatedOrderDiscountXaf: number;
  actualLineRevenueXaf: number;
  actualUnitPriceXaf: number;
  // Phase 2 fields, left null on purpose
  unitCostAtSaleXaf: null;
  totalCostXaf: null;
  lineMarginXaf: null;
  marginRate: null;
}

export interface ComputedOrder {
  subtotalRegularTotalXaf: number;
  productDiscountsTotalXaf: number;
  subtotalAfterDiscountsXaf: number;
  extraCustomerDiscountXaf: number;
  finalSaleTotalXaf: number;
  items: ComputedOrderItem[];
}

/**
 * Rounds to the nearest integer XAF (no fractional currency in this
 * business), using standard rounding. Callers must reconcile the sum of
 * line-level roundings against the order-level discount so totals always
 * tie out exactly (see reconcileRounding below).
 */
function roundXaf(value: number): number {
  return Math.round(value);
}

/**
 * Computes an order's cascade: promo -> subtotal -> proportional extra
 * discount allocation -> actual revenue per line.
 *
 * extraCustomerDiscountXaf is an absolute XAF amount (not a rate) taken off
 * the order, matching the brief's worked example (remise supplémentaire =
 * 4 800 XAF = 10% of a 48 000 subtotal).
 */
export function computeOrder(
  lines: CatalogLineInput[],
  extraCustomerDiscountXaf: number
): ComputedOrder {
  if (lines.length === 0) {
    throw new Error("computeOrder: at least one line is required");
  }
  if (extraCustomerDiscountXaf < 0) {
    throw new Error("computeOrder: extraCustomerDiscountXaf cannot be negative");
  }

  const lineComputations = lines.map((line) => {
    const effectiveUnitPriceXaf =
      line.promoUnitPriceXaf != null ? line.promoUnitPriceXaf : line.regularUnitPriceXaf;
    const lineSubtotalXaf = effectiveUnitPriceXaf * line.quantity;
    const regularLineTotal = line.regularUnitPriceXaf * line.quantity;
    const productDiscount = regularLineTotal - lineSubtotalXaf;
    return { line, effectiveUnitPriceXaf, lineSubtotalXaf, regularLineTotal, productDiscount };
  });

  const subtotalRegularTotalXaf = lineComputations.reduce((s, c) => s + c.regularLineTotal, 0);
  const productDiscountsTotalXaf = lineComputations.reduce((s, c) => s + c.productDiscount, 0);
  const subtotalAfterDiscountsXaf = subtotalRegularTotalXaf - productDiscountsTotalXaf;

  if (extraCustomerDiscountXaf > subtotalAfterDiscountsXaf) {
    throw new Error(
      "computeOrder: extraCustomerDiscountXaf cannot exceed subtotalAfterDiscountsXaf"
    );
  }

  const discountRate =
    subtotalAfterDiscountsXaf > 0 ? extraCustomerDiscountXaf / subtotalAfterDiscountsXaf : 0;

  // Allocate the extra discount proportionally, then reconcile rounding so
  // the sum of line revenues exactly equals finalSaleTotalXaf (brief
  // requirement: "somme des revenus de ligne = total net de commande").
  let allocatedSoFar = 0;
  const items: ComputedOrderItem[] = lineComputations.map((c, idx) => {
    const isLast = idx === lineComputations.length - 1;
    let allocatedOrderDiscountXaf: number;
    if (isLast) {
      allocatedOrderDiscountXaf = extraCustomerDiscountXaf - allocatedSoFar;
    } else {
      allocatedOrderDiscountXaf = roundXaf(c.lineSubtotalXaf * discountRate);
      allocatedSoFar += allocatedOrderDiscountXaf;
    }

    const actualLineRevenueXaf = c.lineSubtotalXaf - allocatedOrderDiscountXaf;
    const actualUnitPriceXaf =
      c.line.quantity > 0 ? roundXaf(actualLineRevenueXaf / c.line.quantity) : 0;

    return {
      itemType: c.line.itemType,
      itemSku: c.line.sku,
      quantity: c.line.quantity,
      regularUnitPriceXaf: c.line.regularUnitPriceXaf,
      promoUnitPriceXaf: c.line.promoUnitPriceXaf ?? null,
      effectiveUnitPriceXaf: c.effectiveUnitPriceXaf,
      lineSubtotalXaf: c.lineSubtotalXaf,
      allocatedOrderDiscountXaf,
      actualLineRevenueXaf,
      actualUnitPriceXaf,
      unitCostAtSaleXaf: null,
      totalCostXaf: null,
      lineMarginXaf: null,
      marginRate: null,
    };
  });

  const finalSaleTotalXaf = subtotalAfterDiscountsXaf - extraCustomerDiscountXaf;

  return {
    subtotalRegularTotalXaf,
    productDiscountsTotalXaf,
    subtotalAfterDiscountsXaf,
    extraCustomerDiscountXaf,
    finalSaleTotalXaf,
    items,
  };
}

/**
 * Builds the order_item_components snapshot rows for a bundle line, from
 * the bundle's composition AT THE TIME OF SALE (caller must pass in the
 * current bundle_items rows — this function does not fetch them, to keep
 * it pure and testable). This snapshot is what Phase 2 will use to
 * generate real stock movements — never the live bundle_items table.
 */
export function snapshotBundleComponents(
  orderItemQuantity: number,
  composition: BundleComposition[]
): Array<{ productSku: string; quantityPerBundle: number; totalQuantity: number }> {
  return composition.map((c) => ({
    productSku: c.productSku,
    quantityPerBundle: c.quantityPerBundle,
    totalQuantity: c.quantityPerBundle * orderItemQuantity,
  }));
}

/**
 * Computes the maximum number of a given bundle that could be assembled
 * from current available stock per component. This is ALWAYS computed on
 * demand — never stored — per the validated architecture (Challenge C).
 *
 * availableStockBySku: current available quantity per product SKU (Phase 2
 * concern to source correctly from inventory; this function just does the
 * math given whatever numbers it's handed).
 */
export function computeMaxBundlesAvailable(
  composition: BundleComposition[],
  availableStockBySku: Record<string, number>
): number {
  if (composition.length === 0) return 0;
  let max = Infinity;
  for (const c of composition) {
    const available = availableStockBySku[c.productSku] ?? 0;
    const possible = Math.floor(available / c.quantityPerBundle);
    max = Math.min(max, possible);
  }
  return max === Infinity ? 0 : Math.max(0, max);
}
