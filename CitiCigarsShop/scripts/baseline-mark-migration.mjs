// Procédure de baseline générique et réutilisable (point 1, audit) : marque
// UNE migration comme déjà appliquée dans __drizzle_migrations SANS exécuter
// son SQL — utilisée pour 0000_existing_schema_baseline.sql (qui recréerait
// des tables déjà réelles si on l'exécutait). Reproduit exactement le
// mécanisme interne de drizzle-orm (mysql-core/dialect.js `migrate()`) :
// table `__drizzle_migrations` (id, hash, created_at), hash = sha256 du
// contenu brut du fichier de migration, created_at = `when` de meta/_journal.json.
//
// Validé par exécution réelle contre une instance MariaDB locale jetable
// (127.0.0.1:3399, jamais une vraie DB) : baseline de 0000 + `drizzle-kit
// migrate` a appliqué 0001-0005 proprement, sans aucune tentative de
// recréer products/users/product_images/bundles/bundle_items.
//
// Usage :
//   DATABASE_URL="mysql://user:pass@host/db" node scripts/baseline-mark-migration.mjs 0000_existing_schema_baseline
//
// Puis, séparément (jamais dans le même script, pour garder les deux étapes
// auditables indépendamment) :
//   DATABASE_URL="mysql://user:pass@host/db" npx drizzle-kit migrate --config=drizzle.config.mysql.ts

import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import crypto from "crypto";

const tag = process.argv[2];
if (!tag) {
  console.error("Usage: DATABASE_URL=... node scripts/baseline-mark-migration.mjs <tag_de_migration_sans_.sql>");
  console.error("Exemple: node scripts/baseline-mark-migration.mjs 0000_existing_schema_baseline");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL doit être défini (jamais exécuté par défaut contre une base implicite).");
  process.exit(1);
}

const journal = JSON.parse(readFileSync("migrations-mysql/meta/_journal.json", "utf-8"));
const entry = journal.entries.find((e) => e.tag === tag);
if (!entry) {
  console.error(`Migration "${tag}" introuvable dans meta/_journal.json`);
  process.exit(1);
}

const sql = readFileSync(`migrations-mysql/${tag}.sql`, "utf-8");
const hash = crypto.createHash("sha256").update(sql).digest("hex");

const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [existingTables] = await conn.query("SHOW TABLES LIKE '__drizzle_migrations'");
  await conn.query(
    "CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (id serial primary key, hash text not null, created_at bigint)",
  );
  const [already] = await conn.query("SELECT id FROM `__drizzle_migrations` WHERE hash = ?", [hash]);
  if (already.length) {
    console.log(`"${tag}" est déjà marquée comme appliquée (hash identique trouvé). Rien à faire.`);
  } else {
    await conn.query("INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES (?, ?)", [hash, entry.when]);
    console.log(`Baseline posée pour "${tag}" : hash=${hash} created_at=${entry.when}.`);
    console.log(`Son SQL n'a PAS été exécuté par ce script — seule la marque d'application a été insérée.`);
  }
} finally {
  await conn.end();
}
