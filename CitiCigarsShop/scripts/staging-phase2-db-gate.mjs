import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { once } from "node:events";
import path from "node:path";
import { createGzip, gunzipSync } from "node:zlib";
import mysqlCore from "mysql2";
import mysql from "mysql2/promise";

function readOption(name) {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return argument?.slice(prefix.length) ?? null;
}

const urlFile = readOption("url-file");
const backupFile = readOption("backup-file");

if (!urlFile) {
  throw new Error("--url-file is required");
}

const databaseUrl = (await fs.readFile(urlFile, "utf8")).trim();
const parsedUrl = new URL(databaseUrl);

if (!['mysql:', 'mariadb:'].includes(parsedUrl.protocol)) {
  throw new Error("The staging database URL must use mysql:// or mariadb://");
}

const connection = await mysql.createConnection({
  uri: databaseUrl,
  // A logical dump must preserve JSON as JSON text. mysql2 otherwise parses
  // JSON columns into objects and its generic SQL escaper emits assignment
  // expressions instead of a restorable scalar value.
  jsonStrings: true,
});

function quoteIdentifier(identifier) {
  return `\`${identifier.replaceAll("`", "``")}\``;
}

async function writeChunk(stream, value) {
  if (!stream.write(value)) {
    await once(stream, "drain");
  }
}

async function createLogicalBackup(tables, triggers) {
  if (!backupFile) return null;

  await fs.mkdir(path.dirname(backupFile), { recursive: true });
  const output = createWriteStream(backupFile, { flags: "wx", mode: 0o600 });
  const gzip = createGzip({ level: 9 });
  gzip.pipe(output);

  const write = (value) => writeChunk(gzip, value);
  await connection.query("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");

  try {
    await write([
      "-- CitiCigars Phase 2 staging logical backup\n",
      `-- Database: ${parsedUrl.pathname.replace(/^\//, "")}\n`,
      `-- Created UTC: ${new Date().toISOString()}\n`,
      "SET NAMES utf8mb4;\n",
      "SET FOREIGN_KEY_CHECKS=0;\n",
      "SET UNIQUE_CHECKS=0;\n\n",
    ].join(""));

    for (const { tableName, tableType } of tables) {
      if (tableType !== "BASE TABLE") continue;
      const identifier = quoteIdentifier(tableName);
      const [[createRow]] = await connection.query(`SHOW CREATE TABLE ${identifier}`);
      const createSql = createRow["Create Table"];
      await write(`DROP TABLE IF EXISTS ${identifier};\n${createSql};\n`);

      const [columns] = await connection.query(`SHOW COLUMNS FROM ${identifier}`);
      const columnSql = columns.map(({ Field }) => quoteIdentifier(Field)).join(", ");
      const [[countRow]] = await connection.query(`SELECT COUNT(*) AS rowCount FROM ${identifier}`);
      const rowCount = Number(countRow.rowCount);
      const pageSize = 250;

      for (let offset = 0; offset < rowCount; offset += pageSize) {
        const [rows] = await connection.query(
          `SELECT * FROM ${identifier} LIMIT ${pageSize} OFFSET ${offset}`,
        );
        if (!rows.length) continue;
        const values = rows.map((row) =>
          `(${columns.map(({ Field }) => mysqlCore.escape(row[Field])).join(", ")})`,
        ).join(",\n");
        await write(`INSERT INTO ${identifier} (${columnSql}) VALUES\n${values};\n`);
      }
      await write("\n");
    }

    for (const { triggerName } of triggers) {
      const [[triggerRow]] = await connection.query(
        `SHOW CREATE TRIGGER ${quoteIdentifier(triggerName)}`,
      );
      const createSql = triggerRow["SQL Original Statement"];
      await write(`DELIMITER ;;\n${createSql};;\nDELIMITER ;\n\n`);
    }

    await write("SET UNIQUE_CHECKS=1;\nSET FOREIGN_KEY_CHECKS=1;\n");
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK").catch(() => {});
    gzip.destroy(error);
    throw error;
  }

  gzip.end();
  await once(output, "close");
  const contents = await fs.readFile(backupFile);
  if (contents.length < 1024) {
    throw new Error(`Backup is unexpectedly small: ${contents.length} bytes`);
  }
  const restored = gunzipSync(contents);
  if (
    !restored.includes(Buffer.from("CREATE TABLE `__drizzle_migrations`")) ||
    !restored.includes(Buffer.from("SET FOREIGN_KEY_CHECKS=1;"))
  ) {
    throw new Error("Backup verification failed: required logical dump markers are missing");
  }
  return {
    file: backupFile,
    bytes: contents.length,
    uncompressedBytes: restored.length,
    sha256: createHash("sha256").update(contents).digest("hex"),
    verified: true,
  };
}

try {
  const [[identity]] = await connection.query(
    "SELECT DATABASE() AS databaseName, VERSION() AS databaseVersion",
  );
  const [tables] = await connection.query(
    `SELECT table_name AS tableName, table_type AS tableType
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
      ORDER BY table_name`,
  );
  const [triggers] = await connection.query(
    `SELECT trigger_name AS triggerName,
            event_manipulation AS eventManipulation,
            event_object_table AS eventObjectTable,
            action_timing AS actionTiming
       FROM information_schema.triggers
      WHERE trigger_schema = DATABASE()
      ORDER BY trigger_name`,
  );

  const journalTables = tables.filter(({ tableName }) =>
    /drizzle|migration/i.test(tableName),
  );
  const journals = [];

  for (const { tableName } of journalTables) {
    if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
      throw new Error(`Unsafe migration journal name: ${tableName}`);
    }
    const [rows] = await connection.query(
      `SELECT * FROM \`${tableName}\` ORDER BY 1`,
    );
    journals.push({ tableName, rows });
  }

  const importantTables = [
    "products",
    "skus",
    "stock_balances",
    "stock_locations",
    "stock_location_balances",
    "stock_movement_groups",
    "stock_provenance_lots",
    "stock_lot_location_balances",
    "stock_movement_lot_allocations",
    "stock_suppliers",
    "stock_receipts",
    "stock_receipt_items",
    "stock_movements",
    "orders",
    "order_items",
    "customers",
    "customer_dna",
    "customer_dna_recommendations",
    "dna_availability_watch",
    "cigar_catalog",
    "cigar_dna_reviews",
    "cigar_research_pool",
    "cigar_research_pool_evidence",
    "dna_research_cases",
  ];
  const counts = {};
  const tableNames = new Set(tables.map(({ tableName }) => tableName));
  for (const tableName of importantTables) {
    if (!tableNames.has(tableName)) {
      counts[tableName] = null;
      continue;
    }
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS rowCount FROM ${quoteIdentifier(tableName)}`,
    );
    counts[tableName] = Number(row.rowCount);
  }

  const ddlTables = [
    "cigar_catalog",
    "cigar_research_pool",
    "cigar_research_pool_evidence",
    "dna_research_cases",
    "customers",
    "order_items",
    "stock_locations",
    "stock_movement_groups",
  ];
  const definitions = {};
  for (const tableName of ddlTables) {
    if (!tableNames.has(tableName)) continue;
    const [[row]] = await connection.query(
      `SHOW CREATE TABLE ${quoteIdentifier(tableName)}`,
    );
    definitions[tableName] = row["Create Table"];
  }

  const [crmStockColumns] = await connection.query(
    `SELECT table_name AS tableName,
            column_name AS columnName,
            column_type AS columnType,
            character_set_name AS characterSetName,
            collation_name AS collationName
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND (
          (table_name = 'order_items' AND column_name IN (
            'order_item_id', 'stock_disposition', 'stock_type', 'stock_pack_size',
            'stock_source_location_id', 'stock_movement_group_id',
            'stock_non_consumption_reason'
          ))
          OR (table_name = 'stock_locations' AND column_name = 'location_id')
          OR (table_name = 'stock_movement_groups' AND column_name = 'group_id')
        )
      ORDER BY table_name, ordinal_position`,
  );

  const bucketColumns = [
    "on_hand_qty",
    "reserved_client_qty",
    "reserved_event_qty",
    "at_event_qty",
    "deposit_qty",
    "transit_qty",
  ];
  const mismatchPredicate = bucketColumns.map((column) =>
    `COALESCE(parent.\`${column}\`, 0) <> COALESCE(child.\`${column}\`, 0)`,
  ).join(" OR ");
  const childSums = bucketColumns.map((column) =>
    `SUM(\`${column}\`) AS \`${column}\``,
  ).join(", ");
  const [aggregateLocationMismatches] = await connection.query(
    `SELECT parent.sku, parent.type, parent.pack_size
       FROM stock_balances parent
       LEFT JOIN (
         SELECT sku, type, pack_size, ${childSums}
           FROM stock_location_balances
          GROUP BY sku, type, pack_size
       ) child USING (sku, type, pack_size)
      WHERE ${mismatchPredicate}
      UNION ALL
     SELECT child.sku, child.type, child.pack_size
       FROM (
         SELECT sku, type, pack_size
           FROM stock_location_balances
          GROUP BY sku, type, pack_size
       ) child
       LEFT JOIN stock_balances parent USING (sku, type, pack_size)
      WHERE parent.sku IS NULL`,
  );
  const [locationLotMismatches] = await connection.query(
    `SELECT parent.location_id, parent.sku, parent.type, parent.pack_size
       FROM stock_location_balances parent
       LEFT JOIN (
         SELECT location_id, sku, type, pack_size, ${childSums}
           FROM stock_lot_location_balances
          GROUP BY location_id, sku, type, pack_size
       ) child USING (location_id, sku, type, pack_size)
      WHERE ${mismatchPredicate}
      UNION ALL
     SELECT child.location_id, child.sku, child.type, child.pack_size
       FROM (
         SELECT location_id, sku, type, pack_size
           FROM stock_lot_location_balances
          GROUP BY location_id, sku, type, pack_size
       ) child
       LEFT JOIN stock_location_balances parent
         USING (location_id, sku, type, pack_size)
      WHERE parent.location_id IS NULL`,
  );
  const [negativeBuckets] = await connection.query(
    `SELECT 'stock_balances' AS projection, COUNT(*) AS rowCount
       FROM stock_balances
      WHERE ${bucketColumns.map((column) => `\`${column}\` < 0`).join(" OR ")}
      UNION ALL
     SELECT 'stock_location_balances', COUNT(*)
       FROM stock_location_balances
      WHERE ${bucketColumns.map((column) => `\`${column}\` < 0`).join(" OR ")}
      UNION ALL
     SELECT 'stock_lot_location_balances', COUNT(*)
       FROM stock_lot_location_balances
      WHERE ${bucketColumns.map((column) => `\`${column}\` < 0`).join(" OR ")}`,
  );
  const [[legacyLocation]] = await connection.query(
    "SELECT COUNT(*) AS rowCount FROM stock_locations WHERE code = 'LEGACY_UNKNOWN' AND is_system = TRUE",
  );
  const [[legacyLot]] = await connection.query(
    "SELECT COUNT(*) AS rowCount FROM stock_provenance_lots WHERE lot_code = 'LEGACY_UNKNOWN' AND origin_kind = 'LEGACY_UNKNOWN' AND is_system = TRUE",
  );

  const diagnostics = {
    crmStockColumns,
    aggregateLocationMismatchCount: aggregateLocationMismatches.length,
    locationLotMismatchCount: locationLotMismatches.length,
    negativeBuckets,
    legacyUnknownLocationCount: Number(legacyLocation.rowCount),
    legacyUnknownLotCount: Number(legacyLot.rowCount),
  };

  const backup = await createLogicalBackup(tables, triggers);

  console.log(JSON.stringify({
    target: {
      host: parsedUrl.hostname,
      port: parsedUrl.port || "3306",
      database: parsedUrl.pathname.replace(/^\//, ""),
    },
    identity,
    tableCount: tables.length,
    tables,
    triggerCount: triggers.length,
    triggers,
    journals,
    counts,
    definitions,
    diagnostics,
    backup,
  }, null, 2));
} finally {
  await connection.end();
}
