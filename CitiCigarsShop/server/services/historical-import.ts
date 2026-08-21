import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db.mysql";
import { customers } from "../../shared/schema.crm";
import { orders, orderItems } from "../../shared/schema.sales";
import { normalizePhone, findExactPhoneMatch } from "./phone";

/**
 * Historical sales import — idempotent by design (brief correction #6):
 * each historical order row carries (sourceSystem, sourceRecordId), enforced
 * unique at the DB level (see schema.sales.ts: uq_orders_source_record).
 * Re-running the same import batch never duplicates a sale.
 *
 * Phase 1 scope: revenue only (CA, order count, basket, last sale). Cost/
 * margin stay null — see Challenge A. Phase 2 will backfill cost only from
 * a documented, provenance-tracked source, never fabricated.
 */

export interface HistoricalOrderRow {
  sourceSystem: string; // e.g. "master_gestion_v3"
  sourceRecordId: string; // stable id from the source (row ref, invoice no, etc.)
  customerName: string;
  customerPhoneRaw?: string | null;
  orderDate: string; // ISO date
  finalSaleTotalXaf: number;
  lineItems: Array<{
    sku: string;
    itemType: "PRODUCT" | "BUNDLE" | "ACCESSORY" | "SERVICE" | "CUSTOM";
    quantity: number;
    actualUnitPriceXaf: number;
  }>;
  notes?: string;
}

export type ImportRowOutcome =
  | { status: "would_create_order"; row: HistoricalOrderRow; matchedCustomerId: string | null }
  | { status: "already_imported"; row: HistoricalOrderRow; existingOrderId: string }
  | { status: "needs_review"; row: HistoricalOrderRow; reason: string };

export interface DryRunReport {
  totalRows: number;
  wouldCreate: number;
  alreadyImported: number;
  needsReview: number;
  outcomes: ImportRowOutcome[];
}

function rowHash(row: HistoricalOrderRow): string {
  const payload = JSON.stringify({
    customerName: row.customerName,
    orderDate: row.orderDate,
    finalSaleTotalXaf: row.finalSaleTotalXaf,
    lineItems: row.lineItems,
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Resolves a customer for a historical row:
 *  - exact normalized phone match -> reuse that customer (safe, automatic)
 *  - no phone / no match -> flagged for human review, NEVER auto-created
 *    from a name-only match (brief: "zéro fusion automatique douteuse")
 */
async function resolveCustomerForRow(
  row: HistoricalOrderRow
): Promise<{ customerId: string | null; needsReview: boolean; reason?: string }> {
  const normalizedPhone = normalizePhone(row.customerPhoneRaw ?? null);
  if (!normalizedPhone) {
    return {
      customerId: null,
      needsReview: true,
      reason: "Aucun téléphone exploitable pour ce client historique — rapprochement par nom seul non autorisé.",
    };
  }

  const candidates = await db
    .select({ customerId: customers.customerId, phoneWhatsapp: customers.phoneWhatsapp })
    .from(customers)
    .where(eq(customers.phoneWhatsapp, normalizedPhone));

  const match = findExactPhoneMatch(normalizedPhone, candidates);
  if (match) {
    return { customerId: match.customerId, needsReview: false };
  }

  // Valid phone, no existing customer -> safe to create a new one (not a
  // merge, just a new record), so this is NOT flagged for review.
  return { customerId: null, needsReview: false };
}

/**
 * Dry-run: never writes to the database. Produces a report so a human can
 * validate before the real import runs. Matches the required workflow:
 * "dry run -> rapport d'écarts -> validation -> import -> rerun sans
 * duplication".
 */
export async function dryRunHistoricalImport(rows: HistoricalOrderRow[]): Promise<DryRunReport> {
  const outcomes: ImportRowOutcome[] = [];

  for (const row of rows) {
    const [existing] = await db
      .select({ orderId: orders.orderId })
      .from(orders)
      .where(and(eq(orders.sourceSystem, row.sourceSystem), eq(orders.sourceRecordId, row.sourceRecordId)));

    if (existing) {
      outcomes.push({ status: "already_imported", row, existingOrderId: existing.orderId });
      continue;
    }

    const resolution = await resolveCustomerForRow(row);
    if (resolution.needsReview) {
      outcomes.push({ status: "needs_review", row, reason: resolution.reason! });
      continue;
    }

    outcomes.push({ status: "would_create_order", row, matchedCustomerId: resolution.customerId });
  }

  return {
    totalRows: rows.length,
    wouldCreate: outcomes.filter((o) => o.status === "would_create_order").length,
    alreadyImported: outcomes.filter((o) => o.status === "already_imported").length,
    needsReview: outcomes.filter((o) => o.status === "needs_review").length,
    outcomes,
  };
}

export interface RealImportOptions {
  importBatchId: string;
  // Rows explicitly approved for import (typically: dry-run outcomes with
  // status "would_create_order", after human review of "needs_review" rows
  // has resolved or excluded them).
  approvedRows: HistoricalOrderRow[];
}

export interface RealImportResult {
  created: number;
  skippedAlreadyImported: number;
  errors: Array<{ row: HistoricalOrderRow; error: string }>;
}

/**
 * Executes the import. Idempotent: re-running with the same rows (same
 * sourceSystem/sourceRecordId) will skip already-imported ones rather than
 * duplicating them, thanks to the DB-level unique constraint.
 */
export async function runHistoricalImport(options: RealImportOptions): Promise<RealImportResult> {
  const result: RealImportResult = { created: 0, skippedAlreadyImported: 0, errors: [] };

  for (const row of options.approvedRows) {
    try {
      const [existing] = await db
        .select({ orderId: orders.orderId })
        .from(orders)
        .where(and(eq(orders.sourceSystem, row.sourceSystem), eq(orders.sourceRecordId, row.sourceRecordId)));

      if (existing) {
        result.skippedAlreadyImported += 1;
        continue;
      }

      const resolution = await resolveCustomerForRow(row);
      let customerId = resolution.customerId;

      if (!customerId) {
        const newCustomerId = crypto.randomUUID();
        const normalizedPhone = normalizePhone(row.customerPhoneRaw ?? null);
        const [firstName, ...rest] = row.customerName.trim().split(" ");
        await db.insert(customers).values({
          customerId: newCustomerId,
          firstName: firstName || row.customerName,
          lastName: rest.join(" ") || null,
          phoneWhatsapp: normalizedPhone,
          phoneRaw: row.customerPhoneRaw ?? null,
          status: "CUSTOMER",
          source: `historical_import:${row.sourceSystem}`,
        } as typeof customers.$inferInsert);
        customerId = newCustomerId;
      }

      const orderId = crypto.randomUUID();
      const subtotal = row.lineItems.reduce((s, li) => s + li.actualUnitPriceXaf * li.quantity, 0);

      await db.insert(orders).values({
        orderId,
        customerId,
        orderDate: new Date(row.orderDate),
        status: "CONFIRMED",
        currency: "XAF",
        subtotalRegularTotalXaf: subtotal,
        productDiscountsTotalXaf: 0,
        subtotalAfterDiscountsXaf: subtotal,
        extraCustomerDiscountXaf: 0,
        finalSaleTotalXaf: row.finalSaleTotalXaf,
        // Cost/margin intentionally left null — Challenge A
        amountPaid: row.finalSaleTotalXaf,
        balanceDue: 0,
        source: "historical_import",
        sourceSystem: row.sourceSystem,
        sourceRecordId: row.sourceRecordId,
        sourceRowHash: rowHash(row),
        importBatchId: options.importBatchId,
        notes: row.notes ?? null,
      } as typeof orders.$inferInsert);

      for (const li of row.lineItems) {
        await db.insert(orderItems).values({
          orderItemId: crypto.randomUUID(),
          orderId,
          itemType: li.itemType,
          itemSku: li.sku,
          quantity: li.quantity,
          regularUnitPriceXaf: li.actualUnitPriceXaf,
          promoUnitPriceXaf: null,
          effectiveUnitPriceXaf: li.actualUnitPriceXaf,
          lineSubtotalXaf: li.actualUnitPriceXaf * li.quantity,
          allocatedOrderDiscountXaf: 0,
          actualLineRevenueXaf: li.actualUnitPriceXaf * li.quantity,
          actualUnitPriceXaf: li.actualUnitPriceXaf,
          // Cost/margin intentionally left null — Challenge A
        } as typeof orderItems.$inferInsert);
      }

      result.created += 1;
    } catch (err) {
      result.errors.push({ row, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return result;
}
