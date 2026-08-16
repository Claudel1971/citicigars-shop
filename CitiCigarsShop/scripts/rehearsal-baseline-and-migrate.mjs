// Répétition RÉELLE de bout en bout contre une instance MariaDB locale JETABLE
// (127.0.0.1:3399, --skip-grant-tables, aucune donnée réelle). Objectif :
// prouver la procédure de baseline + migration incrémentale par exécution,
// pas seulement par relecture de SQL. Ne touche à aucune vraie base.
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import crypto from "crypto";

const DB = "citicigars_rehearsal";
const conn0 = await mysql.createConnection({ host: "127.0.0.1", port: 3399, multipleStatements: true });
await conn0.query(`DROP DATABASE IF EXISTS \`${DB}\``);
await conn0.query(`CREATE DATABASE \`${DB}\``);
await conn0.end();

const db = await mysql.createConnection({ host: "127.0.0.1", port: 3399, database: DB, multipleStatements: true });

function splitStatements(sql) {
  return sql.split("--> statement-breakpoint");
}

async function runFile(path, label) {
  const sql = readFileSync(path, "utf-8");
  const stmts = splitStatements(sql);
  console.log(`\n--- Exécution ${label} (${stmts.length} statement(s)) ---`);
  for (const stmt of stmts) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;
    await db.query(trimmed);
  }
  console.log(`OK ${label}`);
}

// 1) Simule l'état RÉEL déjà existant : exécute 0000 (SEULEMENT sur cette DB
//    jetable, jamais sur une vraie DB, exactement l'avertissement du fichier).
await runFile("migrations-mysql/0000_existing_schema_baseline.sql", "0000_existing_schema_baseline (simule le réel déjà existant)");

// 2) Insère des données FACTICES pour simuler des lignes déjà en production
//    (sinon le backfill ne testerait rien de significatif).
await db.query(`INSERT INTO products (sku, marque) VALUES ('REHEARSAL-SKU-1','Test'), ('REHEARSAL-SKU-2','Test')`);
await db.query(`INSERT INTO bundles (sku, nom, prix_bundle) VALUES ('REHEARSAL-BDL-1','Test Bundle',1000)`);
console.log("\nDonnées factices insérées : 2 products, 1 bundle (simulent la prod réelle)");

// 3) Procédure de baseline déterministe : marque 0000 comme déjà appliquée
//    dans __drizzle_migrations SANS exécuter son SQL une seconde fois (déjà
//    fait à l'étape 1 ici ; sur la vraie DB, 0000 ne serait JAMAIS exécuté du
//    tout — seule cette étape 3 serait faite).
const journal = JSON.parse(readFileSync("migrations-mysql/meta/_journal.json", "utf-8"));
const entry0000 = journal.entries.find((e) => e.tag === "0000_existing_schema_baseline");
const sql0000 = readFileSync(`migrations-mysql/${entry0000.tag}.sql`, "utf-8");
const hash0000 = crypto.createHash("sha256").update(sql0000).digest("hex");

await db.query(
  "CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (id serial primary key, hash text not null, created_at bigint)",
);
await db.query("INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES (?, ?)", [hash0000, entry0000.when]);
console.log(`\nBaseline marquée : __drizzle_migrations contient 0000 (hash=${hash0000.slice(0, 12)}..., created_at=${entry0000.when}) SANS ré-exécuter son SQL.`);

await db.end();
console.log("\n=== Préparation terminée. Lancement de `drizzle-kit migrate` réel ci-après (process séparé). ===");
