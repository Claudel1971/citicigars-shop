// Preuve RÉELLE (audit, point 1, 2e revue) que le seed de genèse est
// globalement atomique : une panne injectée à mi-parcours (~140/257) ne
// laisse AUCUNE trace en base (rollback complet), et une deuxième tentative
// (plan complet, non corrompu) réussit proprement, sans double comptage —
// exactement parce qu'il ne reste rien de la tentative échouée. Exécuté
// contre l'instance MariaDB locale JETABLE (127.0.0.1:3399), jamais une
// vraie DB.

process.env.MYSQL_URL = "mysql://root@127.0.0.1:3399/citicigars_rehearsal";

import mysql from "mysql2/promise";

const CSV_PATH = "migrations-mysql/seed-source/CitiCigars_Migration_Mapping_SKU_CIGAR_ID_Type_v2_20260813.csv";
const RECON_PATH = "migrations-mysql/seed-source/CitiCigars_Reconciliation_Inventaire_13aout_20260813.csv";

let pass = 0;
let fail = 0;
function ok(msg) { pass++; console.log("OK: " + msg); }
function bad(msg) { fail++; console.error("FAIL: " + msg); }

const raw = await mysql.createConnection({ host: "127.0.0.1", port: 3399, database: "citicigars_rehearsal", multipleStatements: true });
console.log("=== Réinitialisation des données (schéma déjà migré) ===");
await raw.query("SET FOREIGN_KEY_CHECKS=0");
for (const t of ["stock_movement_lot_allocations", "stock_movements", "stock_movement_groups", "stock_lot_location_balances", "stock_location_balances", "stock_balances", "pack_size_config", "dna_availability_watch", "dna_leads", "bundle_items", "bundles", "products", "accessories", "cigar_catalog", "skus"]) {
  await raw.query(`TRUNCATE TABLE \`${t}\``);
}
await raw.query("SET FOREIGN_KEY_CHECKS=1");

const { buildSeedPlan, parseMappingCsv } = await import("./seed-stock-central-plan.ts");
const { parseReconciliationCsv, buildReconciliationMap } = await import("./seed-stock-central-reconciliation.ts");
const { db, applySeedPlan, SeedApplyError } = await import("./seed-stock-central-apply.ts");
const { skus, cigarCatalog, stockMovements, stockBalances } = await import("../shared/schema.stock.ts");
const { products } = await import("../shared/schema.mysql.ts");
const { bundles } = await import("../shared/schema.bundles.ts");

const mappingRows = parseMappingCsv(CSV_PATH);
const reconRows = parseReconciliationCsv(RECON_PATH);
const reconMap = buildReconciliationMap(reconRows);
const goodPlan = buildSeedPlan(mappingRows, reconMap);
const expectedMovementGroups = goodPlan.filter((operation) => operation.kind === "MOVEMENT").length;
console.log(`Plan réel: ${goodPlan.length} opérations (attendu 257).`);
if (goodPlan.length !== 257) bad(`Le plan a ${goodPlan.length} opérations, attendu 257 — vérifier les CSV source avant de continuer.`);

// Point 4 (audit) : UPSERT_BUNDLE exige maintenant un bundle déjà existant
// avec un vrai prix. Pré-crée les bundles du plan avec un prix PLACEHOLDER
// explicite (pas une vraie donnée business — juste pour permettre au seed
// de s'exécuter jusqu'au bout dans cette répétition). Insérés HORS de la
// transaction du seed : ne fait donc PAS partie de la preuve de rollback.
const bundleSkusInPlan = [...new Set(goodPlan.filter((o) => o.kind === "UPSERT_BUNDLE").map((o) => o.sku))];
await raw.query(
  `INSERT INTO skus (sku, kind) VALUES ${bundleSkusInPlan.map(() => "(?, 'BUNDLE')").join(",")}`,
  bundleSkusInPlan,
);
for (const sku of bundleSkusInPlan) {
  await raw.query("INSERT INTO bundles (sku, nom, prix_bundle) VALUES (?, 'placeholder', 999900)", [sku]);
}
// Les lignes `skus` pré-créées ici restent en place : le seed fait un UPSERT_SKU
// (onDuplicateKeyUpdate, no-op sur un kind identique) dessus, ce n'est pas une
// écriture bloquante. Elles ne comptent pas dans la preuve de rollback ci-dessous
// (le comparatif "toutes les tables à zéro" exclut délibérément skus/bundles
// pour cette raison — voir la requête de comptage plus bas).
console.log(`${bundleSkusInPlan.length} bundle(s) + sku(s) pré-créé(s) avec un prix placeholder (hors transaction du seed).`);

console.log("\n--- 1. Échec injecté à l'opération ~140/257 : doit ROLLBACK intégralement ---");
const INJECT_AT = 140;
const corruptedPlan = goodPlan.slice();
// SKU garanti déjà créé (UPSERT_SKU) bien avant l'index d'injection : la
// toute première opération SKU_CIGAR_ID du CSV, toujours en tête du plan.
const injectedSku = goodPlan.find((o) => o.kind === "UPSERT_SKU").sku;
corruptedPlan[INJECT_AT] = {
  kind: "MOVEMENT",
  movementType: "VENTE",
  sku: injectedSku,
  type: "Box",
  packSize: 0,
  qty: 999999999, // garantit insufficient_availability_for_vente quel que soit l'état du solde à ce stade
  referenceLabel: "INJECTED_TEST_FAILURE",
  confirmed: true,
};
console.log(`Opération #${INJECT_AT + 1} remplacée par un mouvement VENTE qty=999999999 (échec garanti).`);

let thrown = null;
try {
  await db.transaction(async (tx) => {
    await applySeedPlan(corruptedPlan, tx);
  });
} catch (e) {
  thrown = e;
}

if (thrown instanceof SeedApplyError && thrown.opIndex === INJECT_AT) {
  ok(`L'échec a bien été détecté à l'opération #${thrown.opIndex + 1} (celle injectée), message: ${thrown.cause?.message || thrown.message}`);
} else {
  bad(`Échec attendu à l'opération #${INJECT_AT + 1}, obtenu: ${thrown ? thrown.message : "AUCUNE EXCEPTION (le seed corrompu a réussi, ce qui est un échec de la preuve)"}`);
}

// skus/bundles exclus délibérément : les seules lignes qui y existent après
// le rollback sont les bundles/skus PRÉ-créés hors transaction ci-dessus
// (pour permettre au seed de trouver un bundle existant), pas des résidus
// du seed lui-même. Vérifiés séparément juste après (doivent rester à
// exactement bundleSkusInPlan.length, ni plus ni moins).
const [[countsAfterRollback]] = await raw.query(
  "SELECT (SELECT COUNT(*) FROM cigar_catalog) AS cigar_catalog, (SELECT COUNT(*) FROM products) AS products, (SELECT COUNT(*) FROM stock_movements) AS stock_movements, (SELECT COUNT(*) FROM stock_movement_groups) AS stock_movement_groups, (SELECT COUNT(*) FROM stock_movement_lot_allocations) AS stock_movement_lot_allocations, (SELECT COUNT(*) FROM stock_balances) AS stock_balances, (SELECT COUNT(*) FROM stock_location_balances) AS stock_location_balances, (SELECT COUNT(*) FROM stock_lot_location_balances) AS stock_lot_location_balances, (SELECT COUNT(*) FROM bundle_items) AS bundle_items, (SELECT COUNT(*) FROM accessories) AS accessories, (SELECT COUNT(*) FROM pack_size_config) AS pack_size_config",
);
const allZero = Object.values(countsAfterRollback).every((v) => Number(v) === 0);
if (allZero) {
  ok(`ROLLBACK complet confirmé : toutes les tables écrites par le seed (hors skus/bundles pré-créés pour le test) sont vides après l'échec (${JSON.stringify(countsAfterRollback)}).`);
} else {
  bad(`Rollback incomplet — des lignes subsistent après l'échec: ${JSON.stringify(countsAfterRollback)}`);
}

const [[skusCountAfterRollback]] = await raw.query("SELECT COUNT(*) AS cnt FROM skus");
if (Number(skusCountAfterRollback.cnt) === bundleSkusInPlan.length) {
  ok(`Table skus : exactement les ${bundleSkusInPlan.length} sku(s) bundle pré-créés hors transaction subsistent, aucun sku créé par le seed lui-même n'a survécu au rollback.`);
} else {
  bad(`Table skus après rollback: ${skusCountAfterRollback.cnt} ligne(s), attendu exactement ${bundleSkusInPlan.length} (les pré-créés hors transaction).`);
}

console.log("\n--- 2. Deuxième tentative (plan complet, non corrompu) après l'échec : doit réussir sans --force, sans double comptage ---");
let secondAttemptError = null;
try {
  await db.transaction(async (tx) => {
    await applySeedPlan(goodPlan, tx);
  });
} catch (e) {
  secondAttemptError = e;
}

if (!secondAttemptError) {
  ok("Deuxième tentative (plan complet) réussie après le rollback de la première, sans --force et sans avoir eu besoin de nettoyer quoi que ce soit manuellement.");
} else {
  bad(`Deuxième tentative échouée alors qu'elle aurait dû réussir sur une base vide: ${secondAttemptError.message}`);
}

const [[finalCounts]] = await raw.query(
  "SELECT (SELECT COUNT(*) FROM skus) AS skus, (SELECT COUNT(*) FROM cigar_catalog) AS cigar_catalog, (SELECT COUNT(*) FROM stock_movements) AS stock_movements, (SELECT COUNT(*) FROM stock_movement_groups) AS stock_movement_groups, (SELECT COUNT(*) FROM stock_movement_lot_allocations) AS stock_movement_lot_allocations, (SELECT COUNT(*) FROM stock_balances) AS stock_balances, (SELECT COUNT(*) FROM stock_location_balances) AS stock_location_balances, (SELECT COUNT(*) FROM stock_lot_location_balances) AS stock_lot_location_balances, (SELECT COUNT(*) FROM bundle_items) AS bundle_items, (SELECT COUNT(*) FROM pack_size_config) AS pack_size_config",
);
console.log("Comptes finaux:", finalCounts);
// Comptes connus (déjà vérifiés contre le dry-run en mémoire dans le commit précédent).
const expected = { skus: 55, cigar_catalog: 46, stock_movements: 59, stock_movement_groups: expectedMovementGroups, stock_movement_lot_allocations: 59, stock_balances: 45, stock_location_balances: 45, stock_lot_location_balances: 45, bundle_items: 20, pack_size_config: 15 };
let countsMatch = true;
for (const [k, v] of Object.entries(expected)) {
  if (Number(finalCounts[k]) !== v) {
    countsMatch = false;
    bad(`Comptage final "${k}" = ${finalCounts[k]}, attendu ${v} — signe possible de double comptage ou d'application partielle.`);
  }
}
if (countsMatch) {
  ok("Tous les comptages finaux correspondent exactement aux totaux déjà vérifiés (aucun doublon, aucune perte) — la reprise après échec est propre.");
}

const [[boxNonBundle]] = await raw.query(`
  SELECT SUM(sb.on_hand_qty) AS on_hand, SUM(sb.deposit_qty) AS deposit
  FROM stock_balances sb LEFT JOIN bundles b ON b.sku = sb.sku
  WHERE sb.type='Box' AND b.sku IS NULL
`);
if (Number(boxNonBundle.on_hand) === 26 && Number(boxNonBundle.deposit) === 3) {
  ok(`Totaux Box (hors bundle) exacts après reprise: onHand=26, deposit=3 — identiques à la première application réussie du commit précédent.`);
} else {
  bad(`Totaux Box (hors bundle) inattendus après reprise: ${JSON.stringify(boxNonBundle)}`);
}

console.log("\n--- 3. UPSERT_BUNDLE pour un bundle réellement inexistant : échoue explicitement, n'invente jamais prixBundle=0 (point 4) ---");
{
  const { applyOp } = await import("./seed-stock-central-apply.ts");
  let threw = null;
  try {
    await db.transaction(async (tx) => {
      await applyOp({ kind: "UPSERT_BUNDLE", sku: "BUNDLE-NEVER-CREATED-XYZ", nom: "Test" }, tx);
    });
  } catch (e) {
    threw = e;
  }
  if (threw && /n'existe pas encore/.test(threw.message) && /BUNDLE-NEVER-CREATED-XYZ/.test(threw.message)) {
    ok(`UPSERT_BUNDLE pour un bundle inexistant échoue avec un message clair citant le SKU: "${threw.message}"`);
  } else {
    bad(`UPSERT_BUNDLE pour un bundle inexistant: attendu une erreur explicite citant le SKU, obtenu: ${threw ? threw.message : "aucune exception (a inséré silencieusement ?)"}`);
  }
  const [[bundleCheck]] = await raw.query("SELECT COUNT(*) AS cnt FROM bundles WHERE sku='BUNDLE-NEVER-CREATED-XYZ'");
  if (Number(bundleCheck.cnt) === 0) ok("Aucune ligne bundles n'a été créée pour ce SKU inexistant (pas de prixBundle=0 inventé).");
  else bad("Une ligne bundles a été créée malgré l'échec attendu — prixBundle a peut-être été inventé.");
}

await raw.end();
await db.$client.end();

console.log(`\n=== RÉSULTAT: ${pass} OK, ${fail} FAIL ===`);
process.exitCode = fail > 0 ? 1 : 0;
