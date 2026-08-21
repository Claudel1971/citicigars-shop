/**
 * SKU migration CTG* -> CTCG-* using the authoritative, verified mapping
 * (migrations-mysql/sku_legacy_to_ctcg_mapping.csv, 59/59 rows verified
 * present in the final Master).
 *
 * SAFETY: run against the local MariaDB clone only by default. Requires
 * ALLOW_NON_LOCAL_WRITE=1 to target anything else, and even then this
 * script does not verify the target actually has the legacy SKUs — a
 * human must confirm the dry-run report matches expectations first.
 *
 * Method (proven in migrations-mysql/SKU_MIGRATION_AUDIT.md):
 *   1. Add ON UPDATE CASCADE to product_images.sku and bundle_items.*_sku
 *      FKs (idempotent — skipped if already present).
 *   2. In a single transaction, UPDATE products.sku for each mapped row.
 *      MySQL cascades the rename to product_images/bundle_items.
 *   3. Verify zero orphans and zero remaining legacy-prefixed SKUs.
 *
 * Usage:
 *   MYSQL_URL=... npx tsx scripts/migrate-sku-legacy-to-ctcg.ts --dry-run
 *   MYSQL_URL=... npx tsx scripts/migrate-sku-legacy-to-ctcg.ts --write
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import mysql from "mysql2/promise";

const DIR = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const mode = process.argv.includes("--write") ? "write" : "dry-run";
  const mysqlUrl = process.env.MYSQL_URL;
  if (!mysqlUrl) throw new Error("MYSQL_URL must be set");
  const isLocalClone = /localhost|127\.0\.0\.1/.test(mysqlUrl);
  if (mode === "write" && !isLocalClone && !process.env.ALLOW_NON_LOCAL_WRITE) {
    throw new Error("Refusing to --write against a non-local MYSQL_URL without ALLOW_NON_LOCAL_WRITE=1.");
  }

  const mappingRaw = fs.readFileSync(path.join(DIR, "../migrations-mysql/sku_legacy_to_ctcg_mapping.csv"), "utf-8");
  const mapping: Array<{ legacy_sku: string; new_sku: string; verified_present_in_final_master: string }> = parse(
    mappingRaw,
    { columns: true, skip_empty_lines: true, bom: true }
  );

  const unverified = mapping.filter((m) => m.verified_present_in_final_master !== "YES");
  if (unverified.length > 0) {
    console.error(`Refusing: ${unverified.length} mapping row(s) not marked verified. Aborting.`);
    process.exit(1);
  }

  const conn = await mysql.createConnection(mysqlUrl);

  const [existingRows] = await conn.query<any[]>(
    `SELECT sku FROM products WHERE sku IN (${mapping.map(() => "?").join(",")})`,
    mapping.map((m) => m.legacy_sku)
  );
  const existingLegacySkus = new Set((existingRows as any[]).map((r) => r.sku));

  const toMigrate = mapping.filter((m) => existingLegacySkus.has(m.legacy_sku));
  const notFound = mapping.filter((m) => !existingLegacySkus.has(m.legacy_sku));

  console.log(
    JSON.stringify(
      {
        mode,
        totalMappingRows: mapping.length,
        foundInTargetDb: toMigrate.length,
        notFoundInTargetDb: notFound.length,
        notFoundSample: notFound.slice(0, 5).map((m) => m.legacy_sku),
      },
      null,
      2
    )
  );

  if (mode === "dry-run") {
    console.log("\n--- DRY RUN: aucune écriture effectuée ---");
    await conn.end();
    return;
  }

  if (toMigrate.length === 0) {
    console.log("\nRien à migrer sur cette cible (aucun SKU legacy présent).");
    await conn.end();
    return;
  }

  console.log("\n--- Préparation: ON UPDATE CASCADE sur les FK produit (idempotent) ---");
  // Idempotent: DROP+ADD is safe to re-run — if the constraint doesn't
  // exist under this exact name, the DROP fails harmlessly and we continue.
  const fkStatements = [
    {
      drop: "ALTER TABLE product_images DROP FOREIGN KEY product_images_sku_products_sku_fk",
      add: "ALTER TABLE product_images ADD CONSTRAINT product_images_sku_products_sku_fk FOREIGN KEY (sku) REFERENCES products(sku) ON DELETE CASCADE ON UPDATE CASCADE",
    },
    {
      drop: "ALTER TABLE bundle_items DROP FOREIGN KEY bundle_items_product_sku_products_sku_fk",
      add: "ALTER TABLE bundle_items ADD CONSTRAINT bundle_items_product_sku_products_sku_fk FOREIGN KEY (product_sku) REFERENCES products(sku) ON UPDATE CASCADE",
    },
    {
      drop: "ALTER TABLE bundle_items DROP FOREIGN KEY bundle_items_bundle_sku_bundles_sku_fk",
      add: "ALTER TABLE bundle_items ADD CONSTRAINT bundle_items_bundle_sku_bundles_sku_fk FOREIGN KEY (bundle_sku) REFERENCES bundles(sku) ON DELETE CASCADE ON UPDATE CASCADE",
    },
  ];
  for (const stmt of fkStatements) {
    try {
      await conn.query(stmt.drop);
    } catch (e) {
      // constraint may not exist under this name yet — fine, proceed to add
    }
    await conn.query(stmt.add);
  }
  console.log("✓ ON UPDATE CASCADE en place");

  console.log("\n--- Renommage transactionnel ---");
  await conn.beginTransaction();
  try {
    for (const m of toMigrate) {
      await conn.query("UPDATE products SET sku = ? WHERE sku = ?", [m.new_sku, m.legacy_sku]);
    }
    await conn.commit();
    console.log(`✓ ${toMigrate.length} SKU renommés`);
  } catch (err) {
    await conn.rollback();
    console.error("Rollback — erreur pendant le renommage:", err);
    await conn.end();
    process.exit(1);
  }

  console.log("\n--- Vérification post-migration ---");
  const [remaining] = await conn.query<any[]>("SELECT COUNT(*) as c FROM products WHERE sku LIKE 'CTG%' AND sku NOT LIKE 'CTCG%'");
  const [orphanImages] = await conn.query<any[]>(
    "SELECT COUNT(*) as c FROM product_images pi LEFT JOIN products p ON pi.sku = p.sku WHERE p.sku IS NULL"
  );
  const [orphanBundleItems] = await conn.query<any[]>(
    "SELECT COUNT(*) as c FROM bundle_items bi LEFT JOIN products p ON bi.product_sku = p.sku WHERE p.sku IS NULL"
  );
  console.log({
    remainingLegacySkus: (remaining as any)[0].c,
    orphanProductImages: (orphanImages as any)[0].c,
    orphanBundleItems: (orphanBundleItems as any)[0].c,
  });

  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
