/**
 * Real integration tests against the local MariaDB clone (not vitest —
 * these need a live DB connection, which vitest's unit suite intentionally
 * avoids). Run with:
 *   MYSQL_URL=mysql://citi:citipass@localhost:3306/citicigars_test npx tsx scripts/integration-tests.ts
 *
 * Exits non-zero on any failure.
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../shared/schema";
import { eq } from "drizzle-orm";
import { customers, customerDna, crmFollowups } from "../shared/schema.crm";
import { orders, orderItems } from "../shared/schema.sales";

let pass = 0;
let fail = 0;

function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.error(`  ✗ ${label}`);
    fail++;
  }
}

async function main() {
  const mysqlUrl = process.env.MYSQL_URL;
  if (!mysqlUrl) throw new Error("MYSQL_URL must be set");
  if (!/localhost|127\.0\.0\.1/.test(mysqlUrl)) {
    throw new Error("Integration tests must run against a local clone only.");
  }

  const pool = mysql.createPool({ uri: mysqlUrl });
  const db = drizzle(pool, { schema, mode: "default" });

  console.log("== CRM: customer read-back ==");
  const [nathalie] = await db.select().from(customers).where(eq(customers.customerId, "CTCG-CUST-000001"));
  assert(!!nathalie, "CTCG-CUST-000001 existe");
  assert(nathalie?.phoneWhatsapp === "+237674206719", "téléphone normalisé correct");
  assert(nathalie?.isInternal === false, "client externe: is_internal=false");

  const [citicigars] = await db.select().from(customers).where(eq(customers.customerId, "CTCG-CUST-000000"));
  assert(!!citicigars, "CTCG-CUST-000000 (interne) existe");
  assert(citicigars?.isInternal === true, "client interne: is_internal=true");

  console.log("\n== CRM: orders/order_items relationship ==");
  const customerOrders = await db.select().from(orders).where(eq(orders.customerId, "CTCG-CUST-000001"));
  assert(customerOrders.length >= 1, "Nathalie a au moins 1 commande");

  const items001 = await db.select().from(orderItems).where(eq(orderItems.orderId, "CTCG-SALE-000001"));
  assert(items001.length > 0, "CTCG-SALE-000001 a des lignes");
  assert(
    items001.every((i) => i.itemSku && i.itemSku.length > 0),
    "toutes les lignes ont un item_sku non vide"
  );
  const accessoryLines = items001.filter((i) => i.itemType === "ACCESSORY");
  assert(accessoryLines.length > 0, "des lignes ACCESSORY existent (generic item_sku, pas de FK produit)");

  console.log("\n== CRM: service lines never touch physical stock ==");
  const serviceLines = await db.select().from(orderItems).where(eq(orderItems.itemType, "SERVICE"));
  assert(serviceLines.length === 12, `12 lignes SERVICE trouvées (obtenu ${serviceLines.length})`);
  // Structural check: SERVICE lines carry no location/movement reference in
  // Phase 1 (that concept doesn't exist yet — Phase 2 concern), so this is
  // really just confirming Phase 1 doesn't silently attach one.
  assert(
    serviceLines.every((s) => s.itemSku.startsWith("CTCG-SRV")),
    "toutes les lignes SERVICE ont un SKU CTCG-SRV-*"
  );

  console.log("\n== CRM: followups ==");
  const openFollowups = await db.select().from(crmFollowups).where(eq(crmFollowups.status, "OPEN"));
  assert(openFollowups.length === 4, `4 relances ouvertes (obtenu ${openFollowups.length})`);
  const consignmentFollowup = openFollowups.find((f) => f.action.includes("860 000"));
  assert(!!consignmentFollowup, "la relance de consignation (860 000 XAF) existe");

  console.log("\n== DNA: ingest adapter (server-side call, not HTTP) ==");
  const { ingestDnaResult } = await import("../server/services/dna-intake");
  const dnaResult = await ingestDnaResult({
    contactPhone: "+237674206719", // Nathalie's exact phone -> must auto-link
    profileCode: "TEST-01",
    profileName: "Test Profile",
    engineVersion: "test-1.0",
    fullPayload: { test: true },
    sourceRequestId: "integration-test-dna-001",
  });
  assert(dnaResult.customerId === "CTCG-CUST-000001", "DNA rattaché au bon client via téléphone exact");
  assert(dnaResult.wasExistingCustomer === true, "client existant reconnu, pas dupliqué");

  const dnaAgain = await ingestDnaResult({
    contactPhone: "+237674206719",
    profileCode: "TEST-01",
    profileName: "Test Profile",
    engineVersion: "test-1.0",
    fullPayload: { test: true },
    sourceRequestId: "integration-test-dna-001", // same idempotency key
  });
  assert(dnaAgain.dnaId === dnaResult.dnaId, "idempotence sourceRequestId: pas de doublon créé");

  const dnaRows = await db.select().from(customerDna).where(eq(customerDna.sourceRequestId, "integration-test-dna-001"));
  assert(dnaRows.length === 1, `un seul enregistrement DNA pour cette clé (obtenu ${dnaRows.length})`);

  console.log("\n== CRM: duplicate phone detection (createCustomer) ==");
  const { createCustomer } = await import("../server/services/crm");
  const dup = await createCustomer({
    firstName: "Nathalie",
    lastName: "Test-Duplicate",
    phoneWhatsapp: "674206719", // same number, different raw format, no country code
  } as any);
  assert(dup.wasExistingDuplicate === true, "numéro déjà existant reconnu malgré un format différent");
  assert(dup.customer.customerId === "CTCG-CUST-000001", "aucun nouveau client créé, existant réutilisé");

  console.log("\n== CRM: international phone preserved (+33) ==");
  const [karelle] = await db.select().from(customers).where(eq(customers.customerId, "CTCG-CUST-000006"));
  assert(karelle?.phoneWhatsapp === "+33758470023", "numéro français préservé sans forcer +237");

  console.log("\n== Transaction Explorer: filtres combinés AND ==");
  const { queryTransactions, buildTransactionExportWorkbook } = await import("../server/services/transaction-explorer");

  const allRows = await queryTransactions({});
  assert(allRows.length === 58, `58 lignes sans filtre (obtenu ${allRows.length})`);

  const accessoryOnly = await queryTransactions({ itemType: "ACCESSORY" });
  assert(
    accessoryOnly.length === 21 && accessoryOnly.every((r) => r.itemType === "ACCESSORY"),
    `21 lignes ACCESSORY exactement (obtenu ${accessoryOnly.length})`
  );

  const nathalieOrders = await queryTransactions({ customerId: "CTCG-CUST-000001" });
  assert(
    nathalieOrders.length > 0 && nathalieOrders.every((r) => r.customerId === "CTCG-CUST-000001"),
    "filtre customerId isole bien un seul client"
  );

  const combined = await queryTransactions({ customerId: "CTCG-CUST-000001", itemType: "ACCESSORY" });
  assert(
    combined.every((r) => r.customerId === "CTCG-CUST-000001" && r.itemType === "ACCESSORY"),
    "combinaison de 2 filtres = AND (résultat respecte les deux)"
  );
  assert(combined.length <= nathalieOrders.length, "AND réduit ou égale le résultat par rapport à un seul filtre");

  const searchNathalie = await queryTransactions({ search: "Nathalie" });
  assert(
    searchNathalie.length > 0 && searchNathalie.every((r) => r.customerName.includes("Nathalie")),
    "recherche texte trouve le client par nom"
  );

  const paidOnly = await queryTransactions({ paymentStatus: "PAID" });
  assert(
    paidOnly.every((r) => r.balanceDue === 0),
    "filtre statut paiement PAID: toutes les lignes ont balance=0"
  );

  const unpaidOnly = await queryTransactions({ paymentStatus: "UNPAID" });
  assert(
    unpaidOnly.every((r) => r.amountPaid === 0),
    "filtre statut paiement UNPAID: toutes les lignes ont amountPaid=0"
  );

  const withDiscount = await queryTransactions({ hasDiscount: true });
  assert(withDiscount.length > 0, "filtre hasDiscount retourne des résultats");

  const withBrand = allRows.filter((r) => r.brand);
  assert(withBrand.length === 58, `58 lignes avec brand renseigné (obtenu ${withBrand.length})`);
  const withVitole = allRows.filter((r) => r.vitole);
  assert(withVitole.length === 26, `26 lignes avec vitole renseignée (obtenu ${withVitole.length})`);
  assert(
    allRows.every((r) => ["PAID", "PARTIAL", "UNPAID"].includes(r.paymentStatus)),
    "paymentStatus calculé sur chaque ligne (PAID/PARTIAL/UNPAID)"
  );

  console.log("\n== Transaction Explorer: export xlsx ==");
  const exportRows = await queryTransactions({});
  const buffer = buildTransactionExportWorkbook(exportRows);
  assert(buffer.length > 0, "buffer xlsx non vide généré");
  assert(Buffer.isBuffer(buffer), "le buffer retourné est bien un Buffer Node");

  console.log("\n== CTCG-SRV-VAL: pas de ligne négative jamais créée ==");
  const { computeValorisationLine } = await import("../server/services/valorisation-rule");
  const negative = computeValorisationLine(50000, [{ sku: "X", normalSellingPriceXaf: 60000, quantity: 1 }]);
  assert(negative.valLineAmountXaf === null, "VAL négative jamais matérialisée en ligne");

  console.log(`\n${pass} passed, ${fail} failed`);
  await pool.end();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
