// Applique RÉELLEMENT le plan de seed (buildSeedPlan) contre une base MySQL/
// MariaDB, via le storage transactionnel (server/storage.stock.ts) pour tous
// les mouvements, et des upserts idempotents pour les données de référence
// (skus, cigar_catalog, products, accessories, bundles, pack_size_config,
// bundle_items).
//
// Garde-fous (audit, point 2) :
//  - MYSQL_URL est OBLIGATOIRE et explicite (server/db.mysql.ts refuse de
//    démarrer sans, aucune DB implicite) ;
//  - par défaut, refuse tout host qui n'est pas localhost/127.0.0.1 — pour
//    exécuter contre autre chose il faut le flag --allow-non-local, qu'on
//    ne passe PAS dans le cadre de cette tâche (test uniquement contre
//    MariaDB jetable) ;
//  - refuse de s'exécuter si stock_movements contient déjà des lignes (ce
//    script est le seed de genèse, censé tourner une seule fois sur un
//    ledger vide) — sauf --force, explicite et non utilisé ici non plus.
//
// Usage :
//   MYSQL_URL="mysql://root@127.0.0.1:3399/citicigars_rehearsal" \
//     npx tsx scripts/seed-stock-central-apply.ts <mapping_csv> [reconciliation_csv]

import { buildSeedPlan, parseMappingCsv, SeedOp } from "./seed-stock-central-plan";
import { parseReconciliationCsv, buildReconciliationMap } from "./seed-stock-central-reconciliation";

const CSV_PATH = process.argv[2];
const RECON_PATH = process.argv[3];
const ALLOW_NON_LOCAL = process.argv.includes("--allow-non-local");
const FORCE = process.argv.includes("--force");

if (!CSV_PATH) {
  console.error("Usage: MYSQL_URL=... npx tsx scripts/seed-stock-central-apply.ts <mapping_csv> [reconciliation_csv] [--allow-non-local] [--force]");
  process.exit(1);
}

if (!process.env.MYSQL_URL) {
  console.error("MYSQL_URL doit être défini explicitement (aucune DB implicite). Format: mysql://user:password@host:port/database");
  process.exit(1);
}

const mysqlUrl = new URL(process.env.MYSQL_URL);
const isLocal = mysqlUrl.hostname === "127.0.0.1" || mysqlUrl.hostname === "localhost";
if (!isLocal && !ALLOW_NON_LOCAL) {
  console.error(
    `MYSQL_URL pointe vers "${mysqlUrl.hostname}", pas localhost/127.0.0.1. ` +
      `Ce script n'est autorisé pour l'instant que contre une instance MariaDB jetable locale. ` +
      `Passe --allow-non-local si tu es certain de vouloir cibler autre chose (jamais fait dans le cadre de cette tâche).`,
  );
  process.exit(1);
}

// Import différé APRÈS les vérifications ci-dessus : server/db.mysql.ts se
// connecte dès son import, on ne veut pas ouvrir de connexion avant d'avoir
// validé les garde-fous.
const { db } = await import("../server/db.mysql");
const { skus, cigarCatalog, accessories, packSizeConfig, stockMovements } = await import("../shared/schema.stock");
const { products } = await import("../shared/schema.mysql");
const { bundles, bundleItems } = await import("../shared/schema.bundles");
const { stockStorage } = await import("../server/storage.stock");
const { eq, and, sql } = await import("drizzle-orm");

async function main() {
  // db.execute() renvoie le tuple mysql2 brut [rows, fields], PAS les lignes
  // directement (piège vérifié empiriquement — voir commit) : ne pas indexer [0]
  // une seconde fois sans déstructurer le tuple d'abord.
  const [movementCountRows] = (await db.execute(sql`SELECT COUNT(*) AS cnt FROM stock_movements`)) as unknown as [{ cnt: number }[], unknown];
  const existingMovements = movementCountRows[0].cnt;
  if (Number(existingMovements) > 0 && !FORCE) {
    console.error(
      `stock_movements contient déjà ${existingMovements} ligne(s). Ce script est le seed de genèse et ne doit tourner ` +
        `qu'une seule fois sur un ledger vide (sinon les quantités seraient comptées en double). Passe --force si tu es ` +
        `certain de vouloir quand même l'exécuter (non utilisé dans le cadre de cette tâche).`,
    );
    process.exit(1);
  }

  const rows = parseMappingCsv(CSV_PATH);
  const reconRows = RECON_PATH ? parseReconciliationCsv(RECON_PATH) : null;
  const reconMap = reconRows ? buildReconciliationMap(reconRows) : null;
  const plan = buildSeedPlan(rows, reconMap);

  console.log(`=== Application réelle du seed contre ${mysqlUrl.hostname} — ${plan.length} opération(s) ===`);

  let applied = 0;
  try {
    for (const op of plan as SeedOp[]) {
      await applyOp(op);
      applied++;
    }
  } catch (error) {
    console.error(`\nÉCHEC à l'opération #${applied + 1}/${plan.length} :`, error);
    console.error(`${applied} opération(s) déjà appliquée(s) avant l'échec (chacune individuellement atomique — pas de ligne partielle).`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n=== ${applied}/${plan.length} opérations appliquées avec succès ===`);
}

async function applyOp(op: SeedOp): Promise<void> {
  switch (op.kind) {
    case "UPSERT_SKU":
      await db.insert(skus).values({ sku: op.sku, kind: op.skuKind }).onDuplicateKeyUpdate({ set: { kind: op.skuKind } });
      break;
    case "UPSERT_CIGAR_CATALOG":
      await db
        .insert(cigarCatalog)
        .values({ cigarId: op.cigarId, marque: op.brand, ligne: op.line, vitole: op.vitole })
        .onDuplicateKeyUpdate({ set: { marque: op.brand, ligne: op.line, vitole: op.vitole } });
      break;
    case "UPSERT_PRODUCT":
      await db
        .insert(products)
        .values({ sku: op.sku, cigarId: op.cigarId, marque: op.brand, ligne: op.line, vitole: op.vitole, cigarsPerBox: op.cigarsPerBox })
        .onDuplicateKeyUpdate({ set: { cigarId: op.cigarId, marque: op.brand, ligne: op.line, vitole: op.vitole, cigarsPerBox: op.cigarsPerBox } });
      break;
    case "UPSERT_ACCESSORY":
      await db
        .insert(accessories)
        .values({ sku: op.sku, nom: op.nom, marque: op.brand })
        .onDuplicateKeyUpdate({ set: { nom: op.nom, marque: op.brand } });
      break;
    case "UPSERT_BUNDLE":
      // prixBundle (NOT NULL en base) hors du périmètre Stock Central — défaut 0,
      // à corriger séparément côté catalogue/pricing (déjà hors scope du dry-run).
      await db
        .insert(bundles)
        .values({ sku: op.sku, nom: op.nom, prixBundle: 0 })
        .onDuplicateKeyUpdate({ set: { nom: op.nom } });
      break;
    case "UPSERT_PACK_SIZE_CONFIG":
      await db
        .insert(packSizeConfig)
        .values({ sku: op.sku, packSize: op.packSize, active: true })
        .onDuplicateKeyUpdate({ set: { active: true } });
      break;
    case "INSERT_BUNDLE_ITEM": {
      // Pas d'unique index naturel sur (bundleSku,productSku,componentCigarId) :
      // vérifie l'existence avant d'insérer pour rester ré-exécutable sans
      // doublons si jamais ce script est relancé après un échec partiel.
      const conditions = [eq(bundleItems.bundleSku, op.bundleSku)];
      if (op.productSku) conditions.push(eq(bundleItems.productSku, op.productSku));
      if (op.componentCigarId) conditions.push(eq(bundleItems.componentCigarId, op.componentCigarId));
      const existing = await db.select({ id: bundleItems.id }).from(bundleItems).where(and(...conditions));
      if (!existing.length) {
        await db.insert(bundleItems).values({
          bundleSku: op.bundleSku,
          productSku: op.productSku,
          componentCigarId: op.componentCigarId,
          quantite: op.qty,
        });
      }
      break;
    }
    case "MOVEMENT":
      await stockStorage.applyMovement({
        sku: op.sku,
        type: op.type!,
        packSize: op.packSize,
        movementType: op.movementType,
        qty: op.qty,
        author: "seed-stock-central-apply",
        referenceType: "OTHER",
        referenceLabel: op.referenceLabel,
        motif: op.confirmed ? undefined : "NON_CONFIRME_INVENTAIRE_13_08",
      });
      break;
  }
}

await main();
process.exit(process.exitCode ?? 0);
