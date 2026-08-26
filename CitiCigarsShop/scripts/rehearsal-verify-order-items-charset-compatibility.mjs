import crypto from "node:crypto";
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const mode = process.argv[2];
const snapshotFile = process.argv[3];
const databaseUrl = process.env.MYSQL_URL;
const allowExactStagingReadOnly = process.argv.includes("--allow-exact-staging-read-only");

if (!['capture', 'verify'].includes(mode) || !snapshotFile || !databaseUrl) {
  throw new Error("Usage: MYSQL_URL=... node scripts/rehearsal-verify-order-items-charset-compatibility.mjs <capture|verify> <snapshot-file>");
}

const target = new URL(databaseUrl);
const isDisposableTarget = (
  target.hostname === "127.0.0.1" &&
  target.port === "3399" &&
  target.pathname.startsWith("/citicigars_")
);
const isExactStagingTarget = (
  allowExactStagingReadOnly &&
  target.hostname === "srv18.swhc.ca" &&
  (target.port === "3306" || target.port === "") &&
  target.pathname === "/bwljrj22_citicigars_staging"
);
if (!isDisposableTarget && !isExactStagingTarget) {
  throw new Error(`STOP_NON_DISPOSABLE_TARGET: ${target.hostname}:${target.port}${target.pathname}`);
}

const connection = await mysql.createConnection({
  uri: databaseUrl,
  dateStrings: true,
  decimalNumbers: false,
  jsonStrings: true,
});

const protectedTables = [
  "orders",
  "order_items",
  "order_item_components",
  "customers",
  "customer_interactions",
  "customer_dna",
  "customer_dna_recommendations",
  "customer_dna_recommendation_events",
  "customer_sourcing_interests",
  "customer_cigar_preferences",
  "crm_followups",
  "crm_saved_views",
  "dna_availability_watch",
  "dna_leads",
  "cigar_catalog",
  "cigar_dna_reviews",
  "cigar_research_pool",
  "cigar_research_pool_evidence",
  "dna_research_cases",
];

function canonicalValue(value) {
  if (Buffer.isBuffer(value)) return { $buffer: value.toString("base64") };
  if (value && typeof value === "object") {
    if (Array.isArray(value)) return value.map(canonicalValue);
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

function hash(value) {
  return crypto.createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)))
    .digest("hex");
}

function quoteIdentifier(identifier) {
  return "`" + identifier.replaceAll("`", "``") + "`";
}

async function primaryKey(tableName) {
  const [rows] = await connection.query(
    `SELECT column_name AS columnName
       FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = 'PRIMARY'
      ORDER BY seq_in_index`,
    [tableName],
  );
  return rows.map(({ columnName }) => columnName);
}

async function tableFingerprint(tableName, columns = null) {
  const selectedColumns = columns ?? (await connection.query(
    `SELECT column_name AS columnName
       FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ?
      ORDER BY ordinal_position`,
    [tableName],
  ))[0].map(({ columnName }) => columnName);
  const orderColumns = await primaryKey(tableName);
  const quoted = selectedColumns.map(quoteIdentifier).join(", ");
  const order = orderColumns.length
    ? ` ORDER BY ${orderColumns.map(quoteIdentifier).join(", ")}`
    : "";
  const [rows] = await connection.query(`SELECT ${quoted} FROM \`${tableName}\`${order}`);
  return { count: rows.length, hash: hash(rows) };
}

async function orderItemsSchema() {
  const [[table]] = await connection.query(
    `SELECT table_name AS tableName,
            table_collation AS tableCollation,
            create_options AS createOptions
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'order_items'`,
  );
  const [columns] = await connection.query(
    `SELECT column_name AS columnName,
            column_type AS columnType,
            is_nullable AS isNullable,
            column_default AS columnDefault,
            character_set_name AS characterSetName,
            collation_name AS collationName,
            extra
       FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'order_items'
      ORDER BY ordinal_position`,
  );
  const [indexes] = await connection.query(
    `SELECT index_name AS indexName,
            non_unique AS nonUnique,
            seq_in_index AS sequence,
            column_name AS columnName,
            collation,
            sub_part AS subPart
       FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'order_items'
      ORDER BY index_name, seq_in_index`,
  );
  const [foreignKeys] = await connection.query(
    `SELECT constraint_name AS constraintName,
            column_name AS columnName,
            referenced_table_name AS referencedTableName,
            referenced_column_name AS referencedColumnName
       FROM information_schema.key_column_usage
      WHERE table_schema = DATABASE()
        AND table_name = 'order_items'
        AND referenced_table_name IS NOT NULL
      ORDER BY constraint_name, ordinal_position`,
  );
  return { table, columns, indexes, foreignKeys };
}

async function capture() {
  const schema = await orderItemsSchema();
  const historicalColumns = schema.columns.map(({ columnName }) => columnName);
  const tables = {};
  for (const tableName of protectedTables) {
    tables[tableName] = await tableFingerprint(
      tableName,
      tableName === "order_items" ? historicalColumns : null,
    );
  }
  const snapshot = {
    databaseVersion: (await connection.query("SELECT VERSION() AS version"))[0][0].version,
    historicalColumns,
    historicalOrderItemsSchema: schema,
    tables,
  };
  await fs.writeFile(snapshotFile, JSON.stringify(snapshot, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ status: "CAPTURED", snapshotFile, ...snapshot }, null, 2));
}

async function verify() {
  const before = JSON.parse(await fs.readFile(snapshotFile, "utf8"));
  const afterSchema = await orderItemsSchema();
  const afterTables = {};
  for (const tableName of protectedTables) {
    afterTables[tableName] = await tableFingerprint(
      tableName,
      tableName === "order_items" ? before.historicalColumns : null,
    );
  }

  const historicalAfterColumns = afterSchema.columns.filter(({ columnName }) =>
    before.historicalColumns.includes(columnName),
  );
  const expectedHistoricalColumns = before.historicalOrderItemsSchema.columns;
  const historicalSchemaUnchanged = hash(historicalAfterColumns) === hash(expectedHistoricalColumns);
  const historicalIndexes = afterSchema.indexes.filter(({ columnName }) =>
    before.historicalColumns.includes(columnName),
  );
  const expectedHistoricalIndexes = before.historicalOrderItemsSchema.indexes;
  const historicalIndexesUnchanged = hash(historicalIndexes) === hash(expectedHistoricalIndexes);
  const historicalForeignKeys = afterSchema.foreignKeys.filter(({ columnName }) =>
    before.historicalColumns.includes(columnName),
  );
  const expectedHistoricalForeignKeys = before.historicalOrderItemsSchema.foreignKeys;
  const historicalForeignKeysUnchanged = hash(historicalForeignKeys) === hash(expectedHistoricalForeignKeys);
  const tableDataUnchanged = Object.fromEntries(protectedTables.map((tableName) => [
    tableName,
    hash(afterTables[tableName]) === hash(before.tables[tableName]),
  ]));
  const newColumns = afterSchema.columns.filter(({ columnName }) =>
    !before.historicalColumns.includes(columnName),
  );
  const [[nonNullStockLinks]] = await connection.query(
    `SELECT COUNT(*) AS rowCount
       FROM order_items
      WHERE stock_disposition IS NOT NULL
         OR stock_type IS NOT NULL
         OR stock_pack_size IS NOT NULL
         OR stock_source_location_id IS NOT NULL
         OR stock_movement_group_id IS NOT NULL
         OR stock_non_consumption_reason IS NOT NULL`,
  );
  const newForeignKeys = afterSchema.foreignKeys.filter(({ constraintName }) =>
    ["fk_order_items_stock_source_location", "fk_order_items_stock_movement_group"].includes(constraintName),
  );
  const failures = [];
  if (!historicalSchemaUnchanged) failures.push("historical_columns_changed");
  if (!historicalIndexesUnchanged) failures.push("historical_indexes_changed");
  if (!historicalForeignKeysUnchanged) failures.push("historical_foreign_keys_changed");
  for (const [tableName, unchanged] of Object.entries(tableDataUnchanged)) {
    if (!unchanged) failures.push(`${tableName}_data_changed`);
  }
  if (afterSchema.table.tableCollation !== "utf8mb4_unicode_ci") failures.push("table_default_not_utf8mb4");
  for (const name of ["stock_source_location_id", "stock_movement_group_id"]) {
    const column = newColumns.find(({ columnName }) => columnName === name);
    if (column?.collationName !== "utf8mb4_unicode_ci") failures.push(`${name}_wrong_collation`);
  }
  if (newForeignKeys.length !== 2) failures.push("stock_foreign_keys_missing");
  if (Number(nonNullStockLinks.rowCount) !== 0) failures.push("historical_stock_links_not_null");

  console.log(JSON.stringify({
    status: failures.length ? "FAIL" : "PASS",
    failures,
    tableDefaultBefore: before.historicalOrderItemsSchema.table.tableCollation,
    tableDefaultAfter: afterSchema.table.tableCollation,
    historicalSchemaUnchanged,
    historicalIndexesUnchanged,
    historicalForeignKeysUnchanged,
    tableDataUnchanged,
    newColumns,
    newForeignKeys,
    historicalNonNullStockLinkRows: Number(nonNullStockLinks.rowCount),
  }, null, 2));
  if (failures.length) process.exitCode = 1;
}

try {
  if (mode === "capture") await capture();
  else await verify();
} finally {
  await connection.end();
}
