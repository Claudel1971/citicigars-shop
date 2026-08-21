/**
 * Phase 1 historical import — Master Gestion V4 FINAL, patched grain
 * (CLAUDE_CONTINUE_NOW.md, source sha256 08ce7017...).
 *
 * Supersedes the earlier 20/25/48 target. Now: 15 revenue orders, 58 line
 * items sourced directly from 12_Mouvements (itemized), 4 followups,
 * 13 customers. order_item_components is NOT populated by this script —
 * per instruction, 12_Mouvements is now the authoritative itemization and
 * the old 48-component snapshot target is superseded. The generic
 * order_item_components table remains in the schema for future composite
 * definitions, just unused by this import.
 *
 * SAFETY: only ever writes to whatever MYSQL_URL points at — run against
 * the local MariaDB clone only. Never production without explicit sign-off.
 *
 * Usage:
 *   MYSQL_URL=mysql://citi:citipass@localhost:3306/citicigars_test \
 *     npx tsx scripts/import-master-gestion-v4-patch.ts --dry-run
 *   MYSQL_URL=... npx tsx scripts/import-master-gestion-v4-patch.ts --write
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../shared/schema";
import { customers, crmFollowups } from "../shared/schema.crm";
import { orders, orderItems } from "../shared/schema.sales";
import { formatCtcgId } from "../server/services/ctcg-id";

const DIR = path.dirname(fileURLToPath(import.meta.url));

function readCsv(file: string): Record<string, string>[] {
  const raw = fs.readFileSync(path.join(DIR, file), "utf-8");
  return parse(raw, { columns: true, skip_empty_lines: true, bom: true });
}

function num(v: string | undefined): number | null {
  if (v === undefined || v === "" || v === null) return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}
function roundInt(v: string | undefined): number {
  const n = num(v);
  return n === null ? 0 : Math.round(n);
}

function formatXaf(amount: number): string {
  // Avoid Intl's fr-FR narrow-no-break-space (U+202F) grouping separator —
  // it renders as an invisible/unexpected character in plain-text contexts
  // (DB text fields, logs, simple UIs). Use a normal space instead.
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

async function main() {
  const mode = process.argv.includes("--write") ? "write" : "dry-run";

  const mysqlUrl = process.env.MYSQL_URL;
  if (!mysqlUrl) throw new Error("MYSQL_URL must be set");
  const isLocalClone = /localhost|127\.0\.0\.1/.test(mysqlUrl);
  if (mode === "write" && !isLocalClone && !process.env.ALLOW_NON_LOCAL_WRITE) {
    throw new Error(
      "Refusing to --write against a non-local MYSQL_URL. Set ALLOW_NON_LOCAL_WRITE=1 " +
        "to override, only after explicit human sign-off on the dry-run report."
    );
  }

  const pool = mysql.createPool({ uri: mysqlUrl });
  const db = drizzle(pool, { schema, mode: "default" });

  const masterCustomers = readCsv("master2_customers.csv");
  const masterOrders = readCsv("master2_orders.csv");
  const masterOrderItems = readCsv("master2_order_items.csv");
  const masterFollowups = readCsv("master2_followups.csv");

  const report = {
    mode,
    customers: { total: masterCustomers.length, external: masterCustomers.filter((c) => c.is_internal !== "TRUE").length },
    exactPhoneMatches: 0,
    newCustomersToCreate: masterCustomers.length,
    collisions: [] as string[],
    invalidPhones: [] as string[],
    nameOnlySuggestions: [] as string[],
    orders: masterOrders.length,
    orderItems: masterOrderItems.length,
    followups: masterFollowups.length,
    itemTypeBreakdown: {} as Record<string, number>,
    financialControls: {
      grossCatalogueXaf: 0,
      netRevenueXaf: 0,
      cashCollectedXaf: 0,
      receivablesXaf: 0,
      actualCogsXaf: 0,
      grossMarginXaf: 0,
    },
    expectedControls: {
      revenueOrders: 15,
      revenueOrderLines: 58,
      customersTotal: 13,
      externalCustomers: 12,
      followups: 4,
      grossCatalogueXaf: 4465500,
      netRevenueXaf: 4009500,
      cashCollectedXaf: 3049500,
      receivablesXaf: 960000,
      actualCogsXaf: 1917592.0746180979,
      grossMarginXaf: 2091907.9253819021,
      consignmentExposureXaf: 860000,
    },
    errors: [] as string[],
  };

  const seenPhones = new Set<string>();
  for (const c of masterCustomers) {
    const phone = c.phone_whatsapp;
    if (!phone) {
      report.invalidPhones.push(`${c.customer_id}: aucun téléphone`);
      continue;
    }
    if (!/^\+\d{8,15}$/.test(phone)) report.invalidPhones.push(`${c.customer_id}: format suspect "${phone}"`);
    if (seenPhones.has(phone)) report.collisions.push(`${phone} apparaît plusieurs fois`);
    seenPhones.add(phone);
  }

  for (const o of masterOrders) {
    report.financialControls.grossCatalogueXaf += roundInt(o.catalogue_total_xaf);
    report.financialControls.netRevenueXaf += roundInt(o.net_total_xaf);
    report.financialControls.cashCollectedXaf += roundInt(o.amount_paid_xaf);
    report.financialControls.receivablesXaf += roundInt(o.balance_due_xaf);
    report.financialControls.actualCogsXaf += num(o.actual_order_cost_xaf) ?? 0;
    report.financialControls.grossMarginXaf += num(o.gross_margin_xaf) ?? 0;
  }

  for (const li of masterOrderItems) {
    report.itemTypeBreakdown[li.item_type] = (report.itemTypeBreakdown[li.item_type] || 0) + 1;
  }

  const checks: string[] = [];
  const e = report.expectedControls;
  const f = report.financialControls;
  if (masterOrders.length !== e.revenueOrders) checks.push(`orders: ${masterOrders.length} ≠ ${e.revenueOrders}`);
  if (masterOrderItems.length !== e.revenueOrderLines)
    checks.push(`order_items: ${masterOrderItems.length} ≠ ${e.revenueOrderLines}`);
  if (masterCustomers.length !== e.customersTotal)
    checks.push(`customers: ${masterCustomers.length} ≠ ${e.customersTotal}`);
  if (masterFollowups.length !== e.followups) checks.push(`followups: ${masterFollowups.length} ≠ ${e.followups}`);
  if (f.grossCatalogueXaf !== e.grossCatalogueXaf)
    checks.push(`catalogue brut: ${f.grossCatalogueXaf} ≠ ${e.grossCatalogueXaf}`);
  if (f.netRevenueXaf !== e.netRevenueXaf) checks.push(`revenu net: ${f.netRevenueXaf} ≠ ${e.netRevenueXaf}`);
  if (f.cashCollectedXaf !== e.cashCollectedXaf) checks.push(`encaissé: ${f.cashCollectedXaf} ≠ ${e.cashCollectedXaf}`);
  if (f.receivablesXaf !== e.receivablesXaf) checks.push(`créances: ${f.receivablesXaf} ≠ ${e.receivablesXaf}`);
  if (Math.abs(f.actualCogsXaf - e.actualCogsXaf) > 1) checks.push(`COGS: ${f.actualCogsXaf} ≠ ${e.actualCogsXaf}`);
  if (Math.abs(f.grossMarginXaf - e.grossMarginXaf) > 1)
    checks.push(`marge: ${f.grossMarginXaf} ≠ ${e.grossMarginXaf}`);

  report.errors = checks;
  console.log(JSON.stringify(report, null, 2));

  if (mode === "dry-run") {
    console.log("\n--- DRY RUN: aucune écriture effectuée ---");
    await pool.end();
    return;
  }
  if (checks.length > 0) {
    console.error("\n--- ÉCARTS DÉTECTÉS: import réel annulé ---");
    await pool.end();
    process.exit(1);
  }

  console.log("\n--- ÉCRITURE RÉELLE (clone local uniquement) ---");

  for (const c of masterCustomers) {
    await db.insert(customers).values({
      customerId: c.customer_id,
      firstName: c.source_name?.split(" ")[0] || c.source_name || null,
      lastName: c.source_name?.split(" ").slice(1).join(" ") || null,
      phoneWhatsapp: c.phone_whatsapp || null,
      phoneRaw: c.phone_whatsapp || null,
      city: c.city || null,
      country: c.country || "Cameroun",
      customerType: "B2C",
      isInternal: c.is_internal === "TRUE",
      source: "historical_import",
      status: "CUSTOMER",
    } as any);
  }
  console.log(`✓ ${masterCustomers.length} customers importés`);

  for (const o of masterOrders) {
    await db.insert(orders).values({
      orderId: o.order_id,
      customerId: o.customer_id,
      orderDate: new Date(o.order_date),
      status: "CONFIRMED",
      currency: o.currency || "XAF",
      subtotalRegularTotalXaf: roundInt(o.catalogue_total_xaf),
      productDiscountsTotalXaf: 0,
      subtotalAfterDiscountsXaf: roundInt(o.catalogue_total_xaf),
      extraCustomerDiscountXaf: roundInt(o.discount_total_xaf),
      finalSaleTotalXaf: roundInt(o.net_total_xaf),
      // Sourced cost/margin — preserved as-is, not a reconstructed Phase-2
      // CMP, per explicit instruction not to "fix" cost semantics.
      totalCostXaf: o.actual_order_cost_xaf ? Math.round(num(o.actual_order_cost_xaf)!) : null,
      grossMarginXaf: o.gross_margin_xaf ? Math.round(num(o.gross_margin_xaf)!) : null,
      grossMarginRate: o.gross_margin_pct || null,
      amountPaid: roundInt(o.amount_paid_xaf),
      balanceDue: roundInt(o.balance_due_xaf),
      paymentDate: o.payment_date ? new Date(o.payment_date) : null,
      source: "historical_import",
      sourceSystem: o.source_system,
      sourceRecordId: o.source_record_id,
      notes: o.offer_labels || null,
    } as any);
  }
  console.log(`✓ ${masterOrders.length} orders importés`);

  for (const li of masterOrderItems) {
    await db.insert(orderItems).values({
      orderItemId: li.order_item_id,
      orderId: li.order_id,
      itemType: li.item_type as any,
      itemSku: li.item_sku,
      brand: li.brand || null,
      series: li.series || null,
      vitole: li.vitole || null,
      customLabel: li.item_type === "CUSTOM" ? li.line_note || null : null,
      quantity: parseInt(li.quantity, 10),
      regularUnitPriceXaf: roundInt(li.allocated_unit_revenue_xaf),
      promoUnitPriceXaf: null,
      effectiveUnitPriceXaf: roundInt(li.allocated_unit_revenue_xaf),
      lineSubtotalXaf: roundInt(li.allocated_line_revenue_xaf),
      allocatedOrderDiscountXaf: 0,
      actualLineRevenueXaf: roundInt(li.allocated_line_revenue_xaf),
      actualUnitPriceXaf: roundInt(li.allocated_unit_revenue_xaf),
      // Sourced standard/actual cost — preserved verbatim, including any
      // variance vs. standard (e.g. exceptional logistics cost).
      standardUnitCostXaf: li.standard_unit_cost_xaf || null,
      standardLineCostXaf: li.standard_line_cost_xaf || null,
      actualLineCostXaf: li.actual_line_cost_xaf || null,
      costVarianceVsStandardXaf: li.cost_variance_vs_standard_xaf || null,
      sourceSystem: li.source_system,
      sourceRecordId: li.source_record_id,
    } as any);
  }
  console.log(`✓ ${masterOrderItems.length} order_items importés`);

  let followupSeq = 1;
  for (const fu of masterFollowups) {
    await db.insert(crmFollowups).values({
      followupId: formatCtcgId("FUP", followupSeq++),
      customerId: fu.customer_id,
      action: `${fu.action} — ${formatXaf(parseInt(fu.amount_xaf, 10))} XAF`,
      dueAt: new Date().toISOString().slice(0, 10),
      status: "OPEN",
    } as any);
  }
  console.log(`✓ ${masterFollowups.length} followups importés`);

  console.log("\n--- IMPORT TERMINÉ SUR LE CLONE LOCAL ---");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
