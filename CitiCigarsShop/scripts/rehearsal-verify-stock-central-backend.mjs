// Tests d'intégration RÉELS (audit, point 4) contre l'instance MariaDB locale
// JETABLE (127.0.0.1:3399, --skip-grant-tables, aucune donnée réelle) —
// jamais une vraie DB. Exerce server/storage.stock.ts (transactions, verrous
// FOR UPDATE, OUVERTURE_BOITE multi-lignes, rollback) et les 3 endpoints DNA
// (server/routes.dna.ts) via de vraies requêtes HTTP contre une instance
// Express minimale montée juste pour ce test.
//
// Pré-requis : la DB 127.0.0.1:3399/citicigars_rehearsal doit déjà être
// baselinée + migrée (0000-0005) — voir scripts/rehearsal-baseline-and-migrate.mjs
// puis `drizzle-kit migrate`. Ce script réinitialise seulement les données
// (TRUNCATE) avant de commencer, pas le schéma.

process.env.MYSQL_URL = "mysql://root@127.0.0.1:3399/citicigars_rehearsal";

import mysql from "mysql2/promise";
import express from "express";
import http from "http";

let pass = 0;
let fail = 0;
function ok(msg) { pass++; console.log("OK: " + msg); }
function bad(msg) { fail++; console.error("FAIL: " + msg); }
async function expectThrow(fn, label) {
  try {
    await fn();
    bad(`${label}: aucune exception levée (attendue)`);
  } catch (e) {
    ok(`${label}: exception levée comme attendu (${e.code || e.message})`);
  }
}

const raw = await mysql.createConnection({ host: "127.0.0.1", port: 3399, database: "citicigars_rehearsal", multipleStatements: true });
console.log("=== Réinitialisation des données (schéma déjà migré, on vide juste les tables) ===");
await raw.query("SET FOREIGN_KEY_CHECKS=0");
for (const t of ["stock_movements", "stock_balances", "pack_size_config", "dna_availability_watch", "dna_leads", "bundle_items", "bundles", "products", "accessories", "cigar_catalog", "skus"]) {
  await raw.query(`TRUNCATE TABLE \`${t}\``);
}
await raw.query("SET FOREIGN_KEY_CHECKS=1");

console.log("=== Fixtures minimales ===");
await raw.query("INSERT INTO skus (sku, kind) VALUES ('CTGTEST01','CIGAR'), ('CTGTEST02','CIGAR'), ('CTGTEST03','CIGAR')");
await raw.query("INSERT INTO cigar_catalog (cigar_id, marque, ligne, vitole) VALUES ('CTG_A','Marque','Ligne','Robusto'), ('CTG_B','Marque','Ligne','Toro'), ('CTG_C','Marque','Ligne','Corona')");
await raw.query("INSERT INTO products (sku, cigar_id, marque, ligne, vitole, cigars_per_box) VALUES ('CTGTEST01','CTG_A','Marque','Ligne','Robusto',20), ('CTGTEST02','CTG_B','Marque','Ligne','Toro',NULL), ('CTGTEST03','CTG_C','Marque','Ligne','Corona',NULL)");
await raw.query("INSERT INTO pack_size_config (sku, pack_size, active) VALUES ('CTGTEST01',4,1), ('CTGTEST01',5,1)");
await raw.end();

const { stockStorage } = await import("../server/storage.stock.ts");
const { db } = await import("../server/db.mysql.ts");
const { registerDnaRoutes } = await import("../server/routes.dna.ts");
const { sql, eq, and } = await import("drizzle-orm");
const { stockBalances, stockMovements, dnaLeads, dnaAvailabilityWatch } = await import("../shared/schema.stock.ts");

async function getBalance(sku, type, packSize) {
  const [row] = await db.select().from(stockBalances).where(and(eq(stockBalances.sku, sku), eq(stockBalances.type, type), eq(stockBalances.packSize, packSize)));
  return row;
}

console.log("\n--- 1. Mouvement simple + ledger atomiques ---");
{
  const res = await stockStorage.applyMovement({ sku: "CTGTEST01", type: "Box", packSize: 0, movementType: "RECEPTION", qty: 10, author: "test" });
  const bal = await getBalance("CTGTEST01", "Box", 0);
  if (bal.onHandQty === 10) ok("RECEPTION: onHand=10 après réception"); else bad(`RECEPTION: onHand attendu=10, obtenu=${bal.onHandQty}`);
  const movements = await db.select().from(stockMovements).where(eq(stockMovements.groupId, res.groupId));
  if (movements.length === 1 && movements[0].qtyBefore === 0 && movements[0].qtyAfter === 10) {
    ok("RECEPTION: 1 ligne ledger, qtyBefore=0/qtyAfter=10, groupId cohérent");
  } else bad(`RECEPTION: ledger inattendu: ${JSON.stringify(movements)}`);
}

console.log("\n--- 2. Rollback intégral sur violation ---");
{
  // RESERVATION_CLIENT de 999 sur availableNow=10 doit échouer ET ne rien écrire.
  const before = await getBalance("CTGTEST01", "Box", 0);
  const movementsBefore = (await db.select().from(stockMovements)).length;
  await expectThrow(
    () => stockStorage.applyMovement({ sku: "CTGTEST01", type: "Box", packSize: 0, movementType: "RESERVATION_CLIENT", qty: 999, author: "test" }),
    "RESERVATION_CLIENT qty=999 sur availableNow=10",
  );
  const after = await getBalance("CTGTEST01", "Box", 0);
  const movementsAfter = (await db.select().from(stockMovements)).length;
  if (JSON.stringify(before) === JSON.stringify(after)) ok("Rollback: stock_balances inchangé après l'échec");
  else bad(`Rollback: stock_balances a changé malgré l'échec: avant=${JSON.stringify(before)} après=${JSON.stringify(after)}`);
  if (movementsBefore === movementsAfter) ok("Rollback: aucune ligne stock_movements ajoutée après l'échec");
  else bad(`Rollback: le nombre de lignes stock_movements a changé (${movementsBefore} -> ${movementsAfter})`);
}

console.log("\n--- 3. VENTE avec réservation (ne doit jamais juger sur availableNow) ---");
{
  await stockStorage.applyMovement({ sku: "CTGTEST01", type: "Box", packSize: 0, movementType: "RESERVATION_CLIENT", qty: 5, author: "test" });
  const mid = await getBalance("CTGTEST01", "Box", 0);
  if (mid.onHandQty === 10 && mid.reservedClientQty === 5) ok("RESERVATION_CLIENT qty=5: onHand=10, reservedClient=5 (availableNow=5)");
  await stockStorage.applyMovement({ sku: "CTGTEST01", type: "Box", packSize: 0, movementType: "VENTE", qty: 5, withReservation: true, author: "test" });
  const after = await getBalance("CTGTEST01", "Box", 0);
  if (after.onHandQty === 5 && after.reservedClientQty === 0) ok("VENTE withReservation=true qty=5: onHand=5, reservedClient=0 (consomme la réservation, pas bloquée par availableNow=0)");
  else bad(`VENTE withReservation: attendu onHand=5/reservedClient=0, obtenu=${JSON.stringify(after)}`);
}

console.log("\n--- 4. OUVERTURE_BOITE atomique multi-lignes ---");
{
  await stockStorage.applyMovement({ sku: "CTGTEST01", type: "Box", packSize: 0, movementType: "RECEPTION", qty: 1, author: "test" }); // onHand Box = 6 avant ouverture
  const boxBefore = await getBalance("CTGTEST01", "Box", 0);
  const res = await stockStorage.applyOuvertureBoite({
    sku: "CTGTEST01",
    sourceBalanceField: "onHand",
    distribution: [{ packSize: 4, packQty: 5 }], // 5*4=20 = cigarsPerBox
    looseQty: 0,
    author: "test",
  });
  const boxAfter = await getBalance("CTGTEST01", "Box", 0);
  const packAfter = await getBalance("CTGTEST01", "Pack", 4);
  if (boxAfter.onHandQty === boxBefore.onHandQty - 1) ok(`OUVERTURE_BOITE: Box onHand décrémenté de 1 (${boxBefore.onHandQty} -> ${boxAfter.onHandQty})`);
  else bad(`OUVERTURE_BOITE: Box onHand attendu=${boxBefore.onHandQty - 1}, obtenu=${boxAfter.onHandQty}`);
  if (packAfter && packAfter.onHandQty === 5) ok("OUVERTURE_BOITE: Pack(packSize=4) onHand=5 créé");
  else bad(`OUVERTURE_BOITE: Pack(4) attendu onHand=5, obtenu=${JSON.stringify(packAfter)}`);
  const movements = await db.select().from(stockMovements).where(eq(stockMovements.groupId, res.groupId));
  if (movements.length === 2) ok("OUVERTURE_BOITE: 2 lignes ledger (source Box + destination Pack), même groupId");
  else bad(`OUVERTURE_BOITE: attendu 2 lignes ledger, obtenu ${movements.length}`);

  await expectThrow(
    () =>
      stockStorage.applyOuvertureBoite({
        sku: "CTGTEST01",
        sourceBalanceField: "onHand",
        distribution: [{ packSize: 4, packQty: 3 }], // 3*4=12 != cigarsPerBox=20
        looseQty: 0,
        author: "test",
      }),
    "OUVERTURE_BOITE avec distribution incohérente (12 != cigarsPerBox=20)",
  );

  // Point 2 (audit, 2e revue) : packSize dupliqué rejeté AVANT d'atteindre le
  // storage — même si le total tombe juste (2*4 + 3*4 = 20 = cigarsPerBox).
  const boxBeforeDup = await getBalance("CTGTEST01", "Box", 0);
  await expectThrow(
    () =>
      stockStorage.applyOuvertureBoite({
        sku: "CTGTEST01",
        sourceBalanceField: "onHand",
        distribution: [
          { packSize: 4, packQty: 2 },
          { packSize: 4, packQty: 3 },
        ],
        looseQty: 0,
        author: "test",
      }),
    "OUVERTURE_BOITE avec packSize dupliqué (4 apparaît deux fois), total pourtant correct",
  );
  const boxAfterDup = await getBalance("CTGTEST01", "Box", 0);
  if (boxBeforeDup.onHandQty === boxAfterDup.onHandQty) {
    ok("OUVERTURE_BOITE packSize dupliqué: rejeté avant toute écriture, Box onHand inchangé (aucune boîte consommée pour une opération invalide)");
  } else {
    bad(`OUVERTURE_BOITE packSize dupliqué: Box onHand a changé malgré le rejet attendu (${boxBeforeDup.onHandQty} -> ${boxAfterDup.onHandQty})`);
  }
}

console.log("\n--- 5. PERTE_CASSE autorisée même en déficit de réservation, CADEAU/ECHANTILLON refusés ---");
{
  await stockStorage.applyMovement({ sku: "CTGTEST02", type: "Box", packSize: 0, movementType: "RECEPTION", qty: 5, author: "test" });
  await stockStorage.applyMovement({ sku: "CTGTEST02", type: "Box", packSize: 0, movementType: "RESERVATION_CLIENT", qty: 5, author: "test" });
  await expectThrow(
    () => stockStorage.applyMovement({ sku: "CTGTEST02", type: "Box", packSize: 0, movementType: "CADEAU", qty: 1, author: "test" }),
    "CADEAU sur stock entièrement réservé",
  );
  const res = await stockStorage.applyMovement({ sku: "CTGTEST02", type: "Box", packSize: 0, movementType: "PERTE_CASSE", qty: 2, author: "test" });
  const bal = await getBalance("CTGTEST02", "Box", 0);
  if (bal.onHandQty === 3 && bal.reservedClientQty === 5) ok("PERTE_CASSE qty=2 sur stock entièrement réservé: autorisée, onHand=3 (déficit de réservation visible ensuite, assumé)");
  else bad(`PERTE_CASSE: attendu onHand=3/reservedClient=5, obtenu=${JSON.stringify(bal)}`);
}

console.log("\n--- 6. Disponibilité DNA batch (Pack/Box uniquement, Loose/deposit/transit exclus) ---");
{
  // CTGTEST03 : Box disponible, Pack indisponible (aucune ligne Pack créée).
  await stockStorage.applyMovement({ sku: "CTGTEST03", type: "Box", packSize: 0, movementType: "RECEPTION", qty: 3, author: "test" });
  // + du Loose et du deposit, qui ne doivent JAMAIS compter comme sellable-now.
  await stockStorage.applyMovement({ sku: "CTGTEST03", type: "Loose", packSize: 0, movementType: "RECEPTION", qty: 2, author: "test" });
  await stockStorage.applyMovement({ sku: "CTGTEST03", type: "Box", packSize: 0, movementType: "MISE_EN_DEPOT", qty: 1, author: "test" });

  const { resolved, unresolved } = await stockStorage.getAvailabilityForCigarIds(["CTG_A", "CTG_C", "CTG_UNKNOWN"]);
  if (unresolved.length === 1 && unresolved[0] === "CTG_UNKNOWN") ok("Disponibilité: CIGAR_ID inconnu correctement séparé dans `unresolved`, jamais omis silencieusement");
  else bad(`Disponibilité: unresolved attendu=["CTG_UNKNOWN"], obtenu=${JSON.stringify(unresolved)}`);

  if (resolved.CTG_A && resolved.CTG_A.boxAvailable === true) ok("Disponibilité: CTG_A (CTGTEST01) boxAvailable=true (Pack disponible / Box... on a consommé du Box en ouverture, revérifions Pack)");
  if (resolved.CTG_A && resolved.CTG_A.packAvailable === true) ok("Disponibilité: CTG_A packAvailable=true (Pack créé à l'étape 4)");

  if (resolved.CTG_C && resolved.CTG_C.boxAvailable === true && resolved.CTG_C.packAvailable === false) {
    ok("Disponibilité: CTG_C (CTGTEST03) Box disponible / Pack indisponible, comme attendu");
  } else bad(`Disponibilité: CTG_C attendu {boxAvailable:true,packAvailable:false}, obtenu=${JSON.stringify(resolved.CTG_C)}`);

  // Réserve tout le Box restant de CTGTEST03 (onHand=3, deposit=1 déjà sorti -> onHand réel=2) pour vérifier false/false.
  const balC = await getBalance("CTGTEST03", "Box", 0);
  await stockStorage.applyMovement({ sku: "CTGTEST03", type: "Box", packSize: 0, movementType: "RESERVATION_CLIENT", qty: balC.onHandQty, author: "test" });
  const { resolved: resolved2 } = await stockStorage.getAvailabilityForCigarIds(["CTG_C"]);
  if (resolved2.CTG_C.boxAvailable === false && resolved2.CTG_C.packAvailable === false) {
    ok("Disponibilité: stock entièrement réservé -> boxAvailable=false, packAvailable=false");
  } else bad(`Disponibilité: attendu false/false après réservation totale, obtenu=${JSON.stringify(resolved2.CTG_C)}`);
}

console.log("\n--- 7. Deux mouvements concurrents sur le même solde proche de zéro (preuve du verrou FOR UPDATE) ---");
{
  await stockStorage.applyMovement({ sku: "CTGTEST02", type: "Pack", packSize: 4, movementType: "RECEPTION", qty: 1, author: "test" });
  const results = await Promise.allSettled([
    stockStorage.applyMovement({ sku: "CTGTEST02", type: "Pack", packSize: 4, movementType: "RESERVATION_CLIENT", qty: 1, author: "test-A" }),
    stockStorage.applyMovement({ sku: "CTGTEST02", type: "Pack", packSize: 4, movementType: "RESERVATION_CLIENT", qty: 1, author: "test-B" }),
  ]);
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  const finalBal = await getBalance("CTGTEST02", "Pack", 4);
  if (succeeded === 1 && failed === 1 && finalBal.reservedClientQty === 1) {
    ok("Concurrence: exactement 1 des 2 réservations concurrentes a réussi, l'autre a échoué proprement, reservedClient=1 (jamais 2, jamais négatif) — le verrou FOR UPDATE fonctionne réellement");
  } else {
    bad(`Concurrence: résultat inattendu — succeeded=${succeeded} failed=${failed} reservedClient=${finalBal.reservedClientQty} (attendu 1/1/1). Le verrou FOR UPDATE ne serialise peut-être pas correctement.`);
  }
}

console.log("\n--- 8. Défense en profondeur applicative : ce module ne fait jamais UPDATE/DELETE sur stock_movements ---");
{
  const fs = await import("fs");
  const src = fs.readFileSync(new URL("../server/storage.stock.ts", import.meta.url), "utf-8");
  const hasUpdateOnMovements = /\.update\(stockMovements\)/.test(src);
  const hasDeleteOnMovements = /\.delete\(stockMovements\)/.test(src);
  if (!hasUpdateOnMovements && !hasDeleteOnMovements) ok("storage.stock.ts ne contient aucun .update(stockMovements) ni .delete(stockMovements)");
  else bad("storage.stock.ts contient un UPDATE ou DELETE sur stockMovements — violation de l'append-only");
}

console.log("\n=== Endpoints HTTP DNA (Express minimal, mêmes routes réelles, même DB) ===");
const app = express();
app.use(express.json());
registerDnaRoutes(app);
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

async function post(path, body) {
  const res = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, json };
}

console.log("\n--- 9. POST /api/dna/availability : réponse batch complète ---");
{
  const r = await post("/api/dna/availability", { cigarIds: ["CTG_A", "CTG_C"] });
  if (r.status === 200 && r.json.availability.CTG_A && r.json.availability.CTG_C) {
    ok("POST /api/dna/availability: 200, réponse batch complète pour les 2 CIGAR_ID connus");
  } else bad(`POST /api/dna/availability (connus): status=${r.status} body=${JSON.stringify(r.json)}`);
}

console.log("\n--- 10. POST /api/dna/availability : CIGAR_ID inconnu = erreur explicite, jamais un 200 partiel ---");
{
  const r = await post("/api/dna/availability", { cigarIds: ["CTG_A", "CTG_DOES_NOT_EXIST"] });
  if (r.status >= 400 && r.status < 600 && r.json && r.json.error === "unresolved_cigar_ids") {
    ok(`POST /api/dna/availability (CIGAR_ID inconnu): status=${r.status} (non-2xx), error=unresolved_cigar_ids — jamais un faux N=0 silencieux`);
  } else bad(`POST /api/dna/availability (inconnu): attendu non-2xx + error=unresolved_cigar_ids, obtenu status=${r.status} body=${JSON.stringify(r.json)}`);
}

console.log("\n--- 11. POST /api/dna/contact rejoué avec le même clientRequestId = une seule ligne ---");
{
  const clientRequestId = "test-crid-" + Date.now();
  const payload = {
    clientRequestId,
    participant: { firstName: "Jean", lastName: "Test" },
    customerDNA: { id: "VEL-1-1", label: "Le Velouté Délicat", family: "veloute", power: 1, intensity: 1, secondaryFamily: null },
    refinements: { spice: 2, sweetness: 3, signatures: [], signatureNoPreference: true, duration: "around_60", ritualMoments: ["evening"] },
    contact: { country: "CM", city: "Douala", phone: "690123456" },
  };
  const r1 = await post("/api/dna/contact", payload);
  const r2 = await post("/api/dna/contact", payload);
  const leadsForCrid = await db.select({ id: dnaLeads.id }).from(dnaLeads).where(eq(dnaLeads.clientRequestId, clientRequestId));
  if (r1.status === 200 && r2.status === 200 && r1.json.leadId === r2.json.leadId && leadsForCrid.length === 1) {
    ok(`POST /api/dna/contact rejoué: même leadId=${r1.json.leadId} les 2 fois, 1 seule ligne en base (created=${r1.json.created}/${r2.json.created})`);
  } else bad(`POST /api/dna/contact rejoué: r1=${JSON.stringify(r1)} r2=${JSON.stringify(r2)} lignes en base=${leadsForCrid.length}`);
}

console.log("\n--- 11b. POST /api/dna/contact CONCURRENT (même clientRequestId, 2 requêtes en vol en même temps) : created correct pour chacune (point 3) ---");
{
  const clientRequestId = "test-crid-concurrent-" + Date.now();
  const payload = {
    clientRequestId,
    participant: { firstName: "Concurrent", lastName: "Test" },
    customerDNA: { id: "BOI-1-1", label: "Le Boisé Délicat", family: "boise", power: 1, intensity: 1, secondaryFamily: null },
    refinements: { spice: 1, sweetness: 1, signatures: [], signatureNoPreference: true, duration: "around_60", ritualMoments: [] },
    contact: { country: "CM", city: "Douala", phone: "690111222" },
  };
  const [rA, rB] = await Promise.all([post("/api/dna/contact", payload), post("/api/dna/contact", payload)]);
  const leadsForCrid = await db.select({ id: dnaLeads.id }).from(dnaLeads).where(eq(dnaLeads.clientRequestId, clientRequestId));
  const createdFlags = [rA.json.created, rB.json.created].sort();
  if (rA.json.leadId === rB.json.leadId && leadsForCrid.length === 1 && JSON.stringify(createdFlags) === JSON.stringify([false, true])) {
    ok(`Course réelle sur /contact: 1 seule ligne en base, exactement une réponse created=true et une created=false (jamais les deux à true) — bug du point 3 corrigé.`);
  } else {
    bad(`Course réelle sur /contact: leadId A=${rA.json.leadId} B=${rB.json.leadId}, lignes en base=${leadsForCrid.length}, created=[${createdFlags}] (attendu exactement [false,true])`);
  }
}

console.log("\n--- 12. POST /api/dna/watch : erreur si le lead n'existe pas ---");
{
  const r = await post("/api/dna/watch", { clientRequestId: "crid-inexistant-" + Date.now(), dnaProfileId: "VEL-1-1", answersSnapshot: {}, refinementsSnapshot: {} });
  if (r.status === 404 && r.json.error === "lead_not_found") ok("POST /api/dna/watch sans lead existant: 404 lead_not_found");
  else bad(`POST /api/dna/watch sans lead: attendu 404/lead_not_found, obtenu status=${r.status} body=${JSON.stringify(r.json)}`);
}

console.log("\n--- 13. POST /api/dna/watch rejoué = un seul watch (idempotent sur leadId) ---");
{
  const clientRequestId = "test-crid-watch-" + Date.now();
  const contactPayload = {
    clientRequestId,
    participant: { firstName: "Awa", lastName: "Test" },
    customerDNA: { id: "GOU-1-1", label: "Le Gourmand Délicat", family: "gourmand", power: 1, intensity: 1, secondaryFamily: null },
    refinements: { spice: 1, sweetness: 1, signatures: [], signatureNoPreference: true, duration: "around_60", ritualMoments: [] },
    contact: { country: "CM", city: "Douala", phone: "690987654" },
  };
  const contactRes = await post("/api/dna/contact", contactPayload);
  const watchPayload = { clientRequestId, dnaProfileId: "GOU-1-1", answersSnapshot: { power: 1, intensity: 1, family: "gourmand", secondaryFamily: null }, refinementsSnapshot: { spice: 1, sweetness: 1, signatures: [], duration: "around_60", ritualMoments: [] }, consentGiven: true, consentTimestamp: new Date().toISOString() };
  const w1 = await post("/api/dna/watch", watchPayload);
  const w2 = await post("/api/dna/watch", watchPayload);
  const watchesForLead = await db.select({ id: dnaAvailabilityWatch.id }).from(dnaAvailabilityWatch).where(eq(dnaAvailabilityWatch.leadId, contactRes.json.leadId));
  if (w1.status === 200 && w2.status === 200 && w1.json.watchId === w2.json.watchId && watchesForLead.length === 1) {
    ok(`POST /api/dna/watch rejoué: même watchId=${w1.json.watchId} les 2 fois, 1 seule ligne en base`);
  } else bad(`POST /api/dna/watch rejoué: w1=${JSON.stringify(w1)} w2=${JSON.stringify(w2)} lignes en base=${watchesForLead.length}`);

  const [leadRow] = await db.select({ capturedAtStep: dnaLeads.capturedAtStep }).from(dnaLeads).where(eq(dnaLeads.clientRequestId, clientRequestId));
  if (leadRow.capturedAtStep === "STEP6_ZERO_CASE") ok("Le lead bascule bien en capturedAtStep=STEP6_ZERO_CASE une fois un watch créé");
  else bad(`capturedAtStep attendu=STEP6_ZERO_CASE, obtenu=${leadRow.capturedAtStep}`);
}

server.close();
await db.$client.end();

console.log(`\n=== RÉSULTAT: ${pass} OK, ${fail} FAIL ===`);
process.exitCode = fail > 0 ? 1 : 0;
