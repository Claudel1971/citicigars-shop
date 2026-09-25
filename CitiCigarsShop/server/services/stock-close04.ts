import { randomUUID } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db.mysql";
import { bundles, bundleItems } from "../../shared/schema.bundles";
import { skus, type StockType, LEGACY_UNKNOWN_LOT_ID } from "../../shared/schema.stock";
import { stockStorage } from "../storage.stock";
import { StockRuleViolation } from "./stock-movement-processor";

export interface DecomposeBundleInput {
  bundleSku: string;
  quantity: number;
  sourceLocationId: string;
  bundlePackSize: number;
  sourceLotId?: string;
  author: string;
  movementDate?: Date;
}

export function physicalBundlePackSize(items: Array<{ quantite: number }>) {
  const total = items.reduce((sum, item) => {
    if (!Number.isInteger(item.quantite) || item.quantite <= 0) throw new StockRuleViolation("invalid_bundle_component_quantity");
    return sum + item.quantite;
  }, 0);
  if (total <= 0) throw new StockRuleViolation("bundle_components_missing");
  return total;
}

export function planBundleComponents(
  items: Array<{ productSku: string | null; quantite: number }>,
  quantity: number,
) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new StockRuleViolation("invalid_bundle_decomposition_quantity");
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!item.productSku) throw new StockRuleViolation("bundle_component_stock_identity_missing");
    if (!Number.isInteger(item.quantite) || item.quantite <= 0) throw new StockRuleViolation("invalid_bundle_component_quantity");
    totals.set(item.productSku, (totals.get(item.productSku) ?? 0) + item.quantite * quantity);
  }
  return Array.from(totals, ([sku, qty]) => ({ sku, qty })).sort((a, b) => a.sku.localeCompare(b.sku));
}

export async function decomposeBundle(input: DecomposeBundleInput) {
  const bundleSku = String(input.bundleSku || "").trim();
  const author = String(input.author || "").trim();
  if (!bundleSku) throw new StockRuleViolation("bundle_sku_required");
  if (!author || author.length > 100) throw new StockRuleViolation("author_required");

  const [bundle] = await db.select({ sku: bundles.sku }).from(bundles).where(eq(bundles.sku, bundleSku));
  if (!bundle) throw new StockRuleViolation("bundle_not_found");

  const items = await db.select({
    productSku: bundleItems.productSku,
    quantite: bundleItems.quantite,
  }).from(bundleItems).where(eq(bundleItems.bundleSku, bundleSku));
  if (!items.length) throw new StockRuleViolation("bundle_components_missing");
  const components = planBundleComponents(items, input.quantity);
  const expectedPackSize = physicalBundlePackSize(items);
  if (input.bundlePackSize !== expectedPackSize) {
    throw new StockRuleViolation("bundle_pack_size_mismatch", `packSize=${input.bundlePackSize}, composition=${expectedPackSize}`);
  }
  const componentSkus = components.map((item) => item.sku);
  const known = await db.select({ sku: skus.sku }).from(skus).where(inArray(skus.sku, componentSkus));
  if (known.length !== componentSkus.length) throw new StockRuleViolation("bundle_component_sku_not_in_stock_catalog");

  const operationId = randomUUID();
  return db.transaction(async (tx: any) => {
    const source = await stockStorage.applyLocationMovement({
      sku: bundleSku,
      type: "Pack",
      packSize: input.bundlePackSize,
      movementType: "DESASSEMBLAGE_COMPOSITE",
      qty: input.quantity,
      sourceLocationId: input.sourceLocationId,
      lotId: input.sourceLotId,
      author,
      referenceType: "OTHER",
      referenceId: operationId,
      referenceLabel: bundleSku,
      comment: `Bundle decomposition source ${bundleSku}`,
      movementDate: input.movementDate,
    }, tx);

    const componentGroups: string[] = [];
    for (const component of components) {
      const result = await stockStorage.applyLocationMovement({
        sku: component.sku,
        type: "Loose",
        packSize: 0,
        movementType: "DESASSEMBLAGE_COMPOSITE",
        qty: component.qty,
        destinationLocationId: input.sourceLocationId,
        lotId: LEGACY_UNKNOWN_LOT_ID,
        author,
        referenceType: "OTHER",
        referenceId: operationId,
        referenceLabel: bundleSku,
        comment: `Bundle decomposition component from ${bundleSku}`,
        movementDate: input.movementDate,
      }, tx);
      componentGroups.push(result.groupId);
    }
    return { operationId, sourceGroupId: source.groupId, componentGroupIds: componentGroups, components };
  });
}
