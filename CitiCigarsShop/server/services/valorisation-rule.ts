/**
 * CTCG-SRV-VAL — "Valorisation de l'ensemble" business rule.
 *
 * STATUS: this is a LIVE rule for future orders, not a Phase 2 concept and
 * not something deferred — see CLAUDE_CONTINUE_NOW.md section 8 and the
 * follow-up clarification. It applies going forward, the moment a
 * gifting/composite order is created through whatever workflow eventually
 * creates live orders (that order-creation workflow itself does not exist
 * yet in Phase 1 — this module only defines the SKU, the model, and the
 * calculation rule so nothing has to be re-derived later).
 *
 * NON-NEGOTIABLE: never retroactively reallocate historical Master Gestion
 * transactions. Historical line revenue already imported is authoritative
 * as-is. This rule only ever applies going forward.
 *
 * Rule:
 *   VAL = net_gift_price - sum(normal_selling_price of each component)
 *   VAL > 0  -> create one non-stock SERVICE order_item with
 *               item_sku = 'CTCG-SRV-VAL', actualLineRevenueXaf = VAL
 *   VAL = 0  -> no VAL line at all
 *   VAL < 0  -> NEVER create a negative VAL line. A negative gap is a
 *               discount/allocation matter (handled by the existing
 *               promo/remise cascade in services/sales.ts), not a
 *               valorisation line.
 *
 * Service lines never move physical stock (see services/sales.ts /
 * schema.sales.ts item_type='SERVICE' — Phase 1 has no inventory ledger
 * yet, so this is a standing constraint to respect once one exists, not
 * something enforced by code today).
 */

export const CTCG_SRV_VAL_SKU = "CTCG-SRV-VAL";
export const CTCG_SRV_VAL_LABEL = "Valorisation de l'ensemble";

export interface GiftComponent {
  sku: string;
  normalSellingPriceXaf: number;
  quantity: number;
}

export interface ValorisationResult {
  /** null when VAL = 0 or VAL < 0 — no line should be created */
  valLineAmountXaf: number | null;
  sumOfComponentSellingPricesXaf: number;
  rawDifferenceXaf: number; // netGiftPriceXaf - sum, before the >0 gate
}

/**
 * Computes whether a CTCG-SRV-VAL line should be created for a composite
 * gift order, and its amount. Never mutates or reallocates anything —
 * pure calculation, to be called by the (not-yet-built) live order
 * creation workflow.
 */
export function computeValorisationLine(
  netGiftPriceXaf: number,
  components: GiftComponent[]
): ValorisationResult {
  const sum = components.reduce((s, c) => s + c.normalSellingPriceXaf * c.quantity, 0);
  const diff = netGiftPriceXaf - sum;
  return {
    valLineAmountXaf: diff > 0 ? diff : null,
    sumOfComponentSellingPricesXaf: sum,
    rawDifferenceXaf: diff,
  };
}
