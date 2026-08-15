// Exécution RÉELLE, mais en mémoire uniquement — aucune connexion DB.
// Rejoue le plan de seed (81 lignes validées + réconciliation inventaire du
// 13/08) à travers stock-movement-processor.ts pour prouver que le seed
// produit des soldes cohérents, avant tout GO d'écriture réelle.

import { buildSeedPlan, parseMappingCsv, SeedOp } from "./seed-stock-central-plan";
import { parseReconciliationCsv, buildReconciliationMap, reconKey } from "./seed-stock-central-reconciliation";
import { ZERO_BALANCE, Balance, applyEffects, effectsForReception, effectsForMiseEnDepot } from "../server/services/stock-movement-processor";

const CSV_PATH = process.argv[2];
const RECON_PATH = process.argv[3];
if (!CSV_PATH) {
  console.error("Usage: tsx scripts/seed-stock-central-dry-run.ts <mapping_csv> [reconciliation_csv]");
  process.exit(1);
}

const rows = parseMappingCsv(CSV_PATH);
const reconRows = RECON_PATH ? parseReconciliationCsv(RECON_PATH) : null;
const reconMap = reconRows ? buildReconciliationMap(reconRows) : null;
const plan = buildSeedPlan(rows, reconMap);

type BalanceKey = string; // `${sku}|${type}|${packSize}`
const balances = new Map<BalanceKey, Balance>();
const skus = new Map<string, string>();
const cigarCatalog = new Map<string, { brand: string; line: string; vitole: string }>();
const bundles = new Set<string>();
const bundleItems: { bundleSku: string; productSku: string | null; componentCigarId: string | null; qty: number }[] = [];
let confirmedMovements = 0;
let unconfirmedMovements = 0;
const unconfirmedLines: string[] = [];

function keyOf(sku: string, type: string, packSize: number): BalanceKey {
  return `${sku}|${type}|${packSize}`;
}

for (const op of plan as SeedOp[]) {
  switch (op.kind) {
    case "UPSERT_SKU":
      skus.set(op.sku, op.skuKind);
      break;
    case "UPSERT_CIGAR_CATALOG":
      cigarCatalog.set(op.cigarId, { brand: op.brand, line: op.line, vitole: op.vitole });
      break;
    case "UPSERT_BUNDLE":
      bundles.add(op.sku);
      break;
    case "INSERT_BUNDLE_ITEM":
      bundleItems.push({ bundleSku: op.bundleSku, productSku: op.productSku, componentCigarId: op.componentCigarId, qty: op.qty });
      break;
    case "MOVEMENT": {
      const k = keyOf(op.sku, op.type!, op.packSize);
      const current = balances.get(k) ?? ZERO_BALANCE;
      const effects = op.movementType === "RECEPTION" ? effectsForReception(op.qty) : effectsForMiseEnDepot(op.qty);
      balances.set(k, applyEffects(current, effects));
      if (op.confirmed) confirmedMovements++;
      else {
        unconfirmedMovements++;
        unconfirmedLines.push(`${op.sku}|${op.type} ${op.movementType} qty=${op.qty} — ${op.referenceLabel}`);
      }
      break;
    }
  }
}

console.log("=== Seed dry-run — mapping 81 lignes + réconciliation inventaire 13/08 (aucune écriture DB) ===");
console.log(`Lignes mapping lues: ${rows.length}`);
console.log(`Lignes réconciliation lues: ${reconRows ? reconRows.length : "AUCUNE (mode sans réconciliation)"}`);
console.log(`Opérations générées: ${plan.length}`);
console.log(`Mouvements CONFIRMÉS (source inventaire 13/08): ${confirmedMovements}`);
console.log(`Mouvements NON CONFIRMÉS (non recomptés, valeur d'origine conservée): ${unconfirmedMovements}`);
console.log(`Lignes stock_balances résultantes: ${balances.size}`);

console.log("\n=== Détail des mouvements NON CONFIRMÉS ===");
unconfirmedLines.forEach((l) => console.log(" - " + l));

// Auto-vérification : les sommes simulées (onHand/deposit) par (sku,type) pour les lignes
// MATCHED doivent être strictement égales à nouveau_held/nouveau_deposit de la réconciliation.
if (reconRows) {
  let mismatches = 0;
  for (const r of reconRows) {
    if (r.status !== "MATCHED") continue;
    const k = keyOf(r.sku, r.type, 0); // packSize non significatif pour cette vérif (on cherche parmi toutes les lignes matching sku+type)
    // reconstruire la vraie clé avec packSize potentiel (Pack) en cherchant parmi les balances
    let found: Balance | undefined;
    for (const [bk, bal] of balances) {
      const [bsku, btype] = bk.split("|");
      if (bsku === r.sku && btype === r.type) { found = bal; break; }
    }
    const expectedHeld = r.newHeld ?? 0;
    const expectedDeposit = r.newDeposit ?? 0;
    // Absence de ligne stock_balances == ZERO_BALANCE : buildSeedPlan ne génère
    // aucun mouvement quand held=0 et deposit=0 (rien à recevoir), donc aucune
    // ligne n'est créée pour ce (sku,type) — ce n'est PAS une anomalie.
    const effective = found ?? ZERO_BALANCE;
    if (effective.onHand !== expectedHeld || effective.deposit !== expectedDeposit) {
      mismatches++;
      console.error(`MISMATCH ${r.sku}|${r.type}: attendu onHand=${expectedHeld}/deposit=${expectedDeposit}, obtenu=${JSON.stringify(effective)}`);
    }
  }
  console.log(`\nAuto-vérification réconciliation -> simulation: ${mismatches === 0 ? "OK, 0 écart" : mismatches + " écart(s) — VOIR CI-DESSUS"}`);
}

// Totaux par catégorie (hors bundles) pour audit rapide
let boxOnHand = 0, boxDeposit = 0, packOnHand = 0, packDeposit = 0, accOnHand = 0, accDeposit = 0, looseOnHand = 0;
let bundleOnHand = 0, bundleDeposit = 0;
for (const [k, bal] of balances) {
  const [sku, type] = k.split("|");
  if (bundles.has(sku)) { bundleOnHand += bal.onHand; bundleDeposit += bal.deposit; continue; }
  if (type === "Box") { boxOnHand += bal.onHand; boxDeposit += bal.deposit; }
  if (type === "Pack") { packOnHand += bal.onHand; packDeposit += bal.deposit; }
  if (type === "Loose") { looseOnHand += bal.onHand; }
  if (type === "Accessory") { accOnHand += bal.onHand; accDeposit += bal.deposit; }
}
console.log("\n=== Totaux simulés (post-réconciliation 13/08) ===");
console.log(`Box:       onHand=${boxOnHand}  deposit=${boxDeposit}`);
console.log(`Pack:      onHand=${packOnHand} (hors bundles)  deposit=${packDeposit}`);
console.log(`Bundle:    onHand=${bundleOnHand}  deposit=${bundleDeposit}`);
console.log(`Accessory: onHand=${accOnHand}  deposit=${accDeposit}`);
console.log(`Loose:     onHand total=${looseOnHand} (NON CONFIRMÉ — voir détail ci-dessus)`);

let looseViolation = false;
for (const [k, bal] of balances) {
  const [, type] = k.split("|");
  if (type === "Loose" && bal.onHand + bal.deposit + bal.atEvent > 4) {
    looseViolation = true;
    console.error(`VIOLATION Loose>4 sur ${k}`);
  }
}
console.log(`\nContrainte Loose<=4 respectée sur tout le seed: ${!looseViolation}`);
