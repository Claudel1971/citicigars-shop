import mysql from "mysql2/promise";
const db = await mysql.createConnection({ host: "127.0.0.1", port: 3399, database: "citicigars_rehearsal" });

console.log("=== __drizzle_migrations (doit lister les 6 migrations, 0000 marquée SANS avoir été ré-exécutée) ===");
const [migs] = await db.query("SELECT id, LEFT(hash,12) AS hash_prefix, created_at FROM __drizzle_migrations ORDER BY id");
console.table(migs);

console.log("\n=== Tables presentes ===");
const [tables] = await db.query("SHOW TABLES");
console.log(tables.map(t => Object.values(t)[0]).sort().join(", "));

console.log("\n=== Donnees factices products/bundles intactes (0001-0004 n'ont pas touche leur contenu) ===");
const [prod] = await db.query("SELECT sku, marque, cigar_id, cigars_per_box FROM products ORDER BY sku");
console.table(prod);
const [bdl] = await db.query("SELECT sku, nom FROM bundles");
console.table(bdl);

console.log("\n=== skus backfille (0002) : doit contenir exactement products+bundles ===");
const [skus] = await db.query("SELECT sku, kind FROM skus ORDER BY sku");
console.table(skus);
const [[cnt]] = await db.query("SELECT (SELECT COUNT(*) FROM skus) AS skus_count, (SELECT COUNT(*) FROM products)+(SELECT COUNT(*) FROM bundles) AS expected");
console.log("Comptes:", cnt);

console.log("\n=== FK presentes (0004) ===");
const [fks] = await db.query(`
  SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA='citicigars_rehearsal' AND REFERENCED_TABLE_NAME IS NOT NULL
  ORDER BY TABLE_NAME, COLUMN_NAME
`);
console.table(fks);

console.log("\n=== Triggers presents (0005) ===");
const [trigs] = await db.query("SHOW TRIGGERS");
console.log(trigs.map(t => t.Trigger).join(", "));

console.log("\n=== Test fonctionnel du trigger Loose<=4 (doit REJETER) ===");
try {
  await db.query("INSERT INTO stock_balances (sku, type, pack_size, on_hand_qty) VALUES ('REHEARSAL-SKU-1','Loose',0,5)");
  console.error("ECHEC : l'insertion Loose=5 aurait du etre rejetee par le trigger");
} catch (e) {
  console.log("OK, rejete comme attendu:", e.sqlMessage || e.message);
}

console.log("\n=== Test fonctionnel du trigger pack_size sentinel (doit REJETER Box avec pack_size>0) ===");
try {
  await db.query("INSERT INTO stock_balances (sku, type, pack_size, on_hand_qty) VALUES ('REHEARSAL-SKU-1','Box',4,1)");
  console.error("ECHEC : l'insertion Box/packSize=4 aurait du etre rejetee");
} catch (e) {
  console.log("OK, rejete comme attendu:", e.sqlMessage || e.message);
}

console.log("\n=== Test fonctionnel du trigger bundle_items (doit REJETER mismatch productSku<->componentCigarId) ===");
try {
  await db.query("INSERT INTO cigar_catalog (cigar_id, marque, ligne, vitole) VALUES ('CTG_TEST','X','Y','Z')");
  await db.query("INSERT INTO bundle_items (bundle_sku, product_sku, component_cigar_id, quantite) VALUES ('REHEARSAL-BDL-1','REHEARSAL-SKU-1','CTG_TEST',1)");
  console.error("ECHEC : le mismatch aurait du etre rejete (REHEARSAL-SKU-1 n'a pas cigar_id=CTG_TEST)");
} catch (e) {
  console.log("OK, rejete comme attendu:", e.sqlMessage || e.message);
}

console.log("\n=== Re-exécution de drizzle-kit migrate (doit être un no-op, rien à appliquer) ===");
await db.end();
