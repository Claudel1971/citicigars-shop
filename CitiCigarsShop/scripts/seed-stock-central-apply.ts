// Applique RÉELLEMENT le plan de seed (buildSeedPlan) contre une base MySQL/
// MariaDB, via le storage transactionnel (server/storage.stock.ts).
//
// Point 1 (audit, 2e revue) : les 257 opérations sont appliquées DANS UNE
// SEULE TRANSACTION GLOBALE (option (a) retenue plutôt que (b) idempotence
// par opération). Raison : ce script est un seed de genèse à usage unique
// sur une DB fraîche — pas un job récurrent sur une base déjà vivante. Les
// opérations MOVEMENT ne sont PAS idempotentes par contenu : le plan lui-même
// émet légitimement deux RECEPTION identiques à la suite pour un même
// (sku,type,packSize) quand held>0 ET deposit>0 (voir seed-stock-central-plan.ts,
// held puis deposit) — un contrôle "cette ligne existe déjà, on saute" y
// perdrait silencieusement la deuxième réception au lieu de la doubler, ce
// qui est PIRE qu'un échec franc. Une transaction globale élimine toute la
// classe de bugs "état partiel après échec" sans avoir à raisonner sur
// l'idempotence de chaque type de mouvement : soit les 257 opérations
// réussissent, soit AUCUNE trace ne reste (rollback complet), et une
// nouvelle tentative repart d'un état strictement vide — jamais besoin de
// --force ni de risque de double comptage. Testé par échec injecté réel
// (voir scripts/rehearsal-verify-seed-atomicity.mjs) : ~140/257 opérations
// puis erreur -> zéro ligne dans stock_movements/stock_balances/skus après
// coup, une deuxième tentative (plan complet, non corrompu) réussit et
// produit les totaux exacts attendus, sans double comptage.
//
// Garde-fous :
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
// Point 4 (audit, 2e revue) : UPSERT_BUNDLE n'invente plus prixBundle=0 pour
// un bundle qui n'existe pas encore — échoue explicitement avec le SKU en
// cause. Un bundle qui existe déjà garde son vrai prix (jamais écrasé, ce
// comportement était déjà correct).
//
// Usage :
//   MYSQL_URL="mysql://root@127.0.0.1:3399/citicigars_rehearsal" \
//     npx tsx scripts/seed-stock-central-apply.ts <mapping_csv> [reconciliation_csv]

import { pathToFileURL } from "url";
import { buildSeedPlan, parseMappingCsv, SeedOp } from "./seed-stock-central-plan";
import { parseReconciliationCsv, buildReconciliationMap } from "./seed-stock-central-reconciliation";

const CSV_PATH = process.argv[2];
const RECON_PATH = process.argv[3];
const ALLOW_NON_LOCAL = process.argv.includes("--allow-non-local");
const FORCE = process.argv.includes("--force");
// pathToFileURL() (pas new URL(argv[1],"file://")) : sur Windows, argv[1] utilise
// des backslashes et une lettre de lecteur que new URL() ne normalise pas de la
// même façon que import.meta.url — la comparaison échouait TOUJOURS sur cette
// machine, donc main() n'était jamais appelé et le script sortait en silence
// avec le code 0 sans rien faire (bug trouvé par exécution réelle, pas en relecture).
const isMainModule = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule && !CSV_PATH) {
  console.error("Usage: MYSQL_URL=... npx tsx scripts/seed-stock-central-apply.ts <mapping_csv> [reconciliation_csv] [--allow-non-local] [--force]");
  process.exit(1);
}

if (isMainModule && !process.env.MYSQL_URL) {
  console.error("MYSQL_URL doit être défini explicitement (aucune DB implicite). Format: mysql://user:password@host:port/database");
  process.exit(1);
}

if (isMainModule && process.env.MYSQL_URL) {
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
}

// Import différé APRÈS les vérifications ci-dessus : server/db.mysql.ts se
// connecte dès son import, on ne veut pas ouvrir de connexion avant d'avoir
// validé les garde-fous. Un module qui importe seulement applySeedPlan/applyOp
// (le test d'atomicité) n'a pas besoin des garde-fous CLI ci-dessus.
export const { db } = await import("../server/db.mysql");
const { skus, cigarCatalog, accessories, packSizeConfig } = await import("../shared/schema.stock");
const { products } = await import("../shared/schema.mysql");
const { bundles, bundleItems } = await import("../shared/schema.bundles");
const { stockStorage } = await import("../server/storage.stock");
const { eq, and, sql } = await import("drizzle-orm");

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class SeedApplyError extends Error {
  opIndex: number;
  constructor(opIndex: number, cause: unknown) {
    super(`Échec à l'opération #${opIndex + 1} : ${cause instanceof Error ? cause.message : String(cause)}`);
    this.opIndex = opIndex;
    this.cause = cause;
  }
}

/** Applique le plan complet DANS la transaction fournie (voir en-tête : atomicité globale, point 1). */
export async function applySeedPlan(plan: SeedOp[], tx: Tx): Promise<void> {
  for (let i = 0; i < plan.length; i++) {
    try {
      await applyOp(plan[i], tx);
    } catch (error) {
      throw new SeedApplyError(i, error);
    }
  }
}

export async function applyOp(op: SeedOp, tx: Tx): Promise<void> {
  switch (op.kind) {
    case "UPSERT_SKU":
      await tx.insert(skus).values({ sku: op.sku, kind: op.skuKind }).onDuplicateKeyUpdate({ set: { kind: op.skuKind } });
      break;
    case "UPSERT_CIGAR_CATALOG":
      await tx
        .insert(cigarCatalog)
        .values({ cigarId: op.cigarId, marque: op.brand, ligne: op.line, vitole: op.vitole })
        .onDuplicateKeyUpdate({ set: { marque: op.brand, ligne: op.line, vitole: op.vitole } });
      break;
    case "UPSERT_PRODUCT":
      await tx
        .insert(products)
        .values({ sku: op.sku, cigarId: op.cigarId, marque: op.brand, ligne: op.line, vitole: op.vitole, cigarsPerBox: op.cigarsPerBox })
        .onDuplicateKeyUpdate({ set: { cigarId: op.cigarId, marque: op.brand, ligne: op.line, vitole: op.vitole, cigarsPerBox: op.cigarsPerBox } });
      break;
    case "UPSERT_ACCESSORY":
      await tx
        .insert(accessories)
        .values({ sku: op.sku, nom: op.nom, marque: op.brand })
        .onDuplicateKeyUpdate({ set: { nom: op.nom, marque: op.brand } });
      break;
    case "UPSERT_BUNDLE": {
      // Point 4 (audit) : jamais de prixBundle inventé pour un nouveau bundle.
      const [existing] = await tx.select({ sku: bundles.sku }).from(bundles).where(eq(bundles.sku, op.sku));
      if (!existing) {
        throw new Error(
          `UPSERT_BUNDLE: le bundle "${op.sku}" (${op.nom}) n'existe pas encore dans \`bundles\` et n'a pas de prixBundle connu ici. ` +
            `Crée d'abord ce bundle avec un vrai prix (catalogue/admin), puis relance le seed.`,
        );
      }
      // Bundle déjà existant : met à jour le nom, garde son vrai prixBundle intact (jamais écrasé).
      await tx.update(bundles).set({ nom: op.nom }).where(eq(bundles.sku, op.sku));
      break;
    }
    case "UPSERT_PACK_SIZE_CONFIG":
      await tx
        .insert(packSizeConfig)
        .values({ sku: op.sku, packSize: op.packSize, active: true })
        .onDuplicateKeyUpdate({ set: { active: true } });
      break;
    case "INSERT_BUNDLE_ITEM": {
      // Pas d'unique index naturel sur (bundleSku,productSku,componentCigarId) :
      // vérifie l'existence avant d'insérer. Avec l'atomicité globale (point 1),
      // ce n'est plus une question de "reprise après échec partiel" (impossible
      // désormais) mais une simple protection si ce script est explicitement
      // relancé par-dessus des données déjà présentes (ex. --force).
      const conditions = [eq(bundleItems.bundleSku, op.bundleSku)];
      if (op.productSku) conditions.push(eq(bundleItems.productSku, op.productSku));
      if (op.componentCigarId) conditions.push(eq(bundleItems.componentCigarId, op.componentCigarId));
      const existing = await tx.select({ id: bundleItems.id }).from(bundleItems).where(and(...conditions));
      if (!existing.length) {
        await tx.insert(bundleItems).values({
          bundleSku: op.bundleSku,
          productSku: op.productSku,
          componentCigarId: op.componentCigarId,
          quantite: op.qty,
        });
      }
      break;
    }
    case "MOVEMENT":
      await stockStorage.applyMovement(
        {
          sku: op.sku,
          type: op.type!,
          packSize: op.packSize,
          movementType: op.movementType,
          qty: op.qty,
          author: "seed-stock-central-apply",
          referenceType: "OTHER",
          referenceLabel: op.referenceLabel,
          motif: op.confirmed ? undefined : "NON_CONFIRME_INVENTAIRE_13_08",
        },
        tx,
      );
      break;
  }
}

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

  console.log(`=== Application réelle du seed — ${plan.length} opération(s), transaction globale unique ===`);

  try {
    await db.transaction(async (tx) => {
      await applySeedPlan(plan as SeedOp[], tx);
    });
  } catch (error) {
    if (error instanceof SeedApplyError) {
      console.error(`\nÉCHEC à l'opération #${error.opIndex + 1}/${plan.length} :`, error.cause);
    } else {
      console.error(`\nÉCHEC (hors boucle d'opérations) :`, error);
    }
    console.error(`Transaction globale : ROLLBACK complet — aucune ligne n'a été laissée en base, aucun --force nécessaire pour réessayer.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n=== ${plan.length}/${plan.length} opérations appliquées avec succès (transaction unique validée) ===`);
}

if (isMainModule) {
  await main();
  process.exit(process.exitCode ?? 0);
}
