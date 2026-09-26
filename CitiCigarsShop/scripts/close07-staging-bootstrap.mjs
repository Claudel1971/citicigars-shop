import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const EXPECTED_DB = "bwljrj22_citicigars_admin_staging";
const url = process.env.MYSQL_URL;
if (!url) throw new Error("MYSQL_URL missing");

const parsed = new URL(url);
const database = parsed.pathname.replace(/^\//, "");
if (database !== EXPECTED_DB) {
  throw new Error(`FAIL-CLOSED: expected DB ${EXPECTED_DB}, got ${database || "<empty>"}`);
}

const connection = await mysql.createConnection(url);

function stripLeadingComments(sql) {
  return sql.replace(/^\s*(?:--[^\n]*\n\s*)*/g, "").trim();
}

function isAllowedSystemInsert(sql) {
  return (
    /INSERT\s+INTO\s+`stock_locations`/i.test(sql) &&
    /LEGACY_UNKNOWN/i.test(sql)
  ) || (
    /INSERT\s+INTO\s+`stock_provenance_lots`/i.test(sql) &&
    /LEGACY_UNKNOWN/i.test(sql)
  );
}

try {
  const [[dbRow]] = await connection.query("SELECT DATABASE() AS db");
  if (dbRow.db !== EXPECTED_DB) {
    throw new Error(`FAIL-CLOSED: connected to unexpected DB ${dbRow.db}`);
  }

  const [[tableCount]] = await connection.query(
    "SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
    [EXPECTED_DB],
  );
  const [[triggerCount]] = await connection.query(
    "SELECT COUNT(*) AS n FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?",
    [EXPECTED_DB],
  );

  if (Number(tableCount.n) !== 0 || Number(triggerCount.n) !== 0) {
    throw new Error(
      `FAIL-CLOSED: staging DB must be empty before bootstrap (tables=${tableCount.n}, triggers=${triggerCount.n})`,
    );
  }

  const migrationsDir = path.resolve("migrations-mysql");
  const files = (await fs.readdir(migrationsDir))
    .filter((name) => /^\d.*\.sql$/.test(name))
    .sort();

  let executedSchemaStatements = 0;
  let installedTriggers = 0;
  let insertedSystemRows = 0;
  let skippedDataStatements = 0;
  let skippedDropTriggerGuards = 0;

  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    const chunks = sql
      .split("--> statement-breakpoint")
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    for (const rawChunk of chunks) {
      const chunk = stripLeadingComments(rawChunk);
      if (!chunk) continue;

      // CLOSE-07 staging invariant: execute no DROP of any kind.
      if (/^DROP\s+TRIGGER\s+IF\s+EXISTS\b/i.test(chunk)) {
        skippedDropTriggerGuards += 1;
        continue;
      }
      if (
        /^DROP\b/i.test(chunk) ||
        /^TRUNCATE\b/i.test(chunk) ||
        /^DELETE\b/i.test(chunk) ||
        /^UPDATE\b/i.test(chunk) ||
        /^REPLACE\b/i.test(chunk) ||
        /^RENAME\b/i.test(chunk) ||
        (/^ALTER\s+TABLE\b/i.test(chunk) && /\bDROP\b/i.test(chunk))
      ) {
        throw new Error(`FAIL-CLOSED: destructive statement rejected in ${file}: ${chunk.slice(0, 120)}`);
      }

      if (/^INSERT\b/i.test(chunk)) {
        if (isAllowedSystemInsert(chunk)) {
          await connection.query(chunk);
          insertedSystemRows += 1;
        } else {
          skippedDataStatements += 1;
        }
        continue;
      }

      if (/^(CREATE|ALTER)\b/i.test(chunk)) {
        await connection.query(chunk);
        executedSchemaStatements += 1;
        if (/^CREATE\s+TRIGGER\b/i.test(chunk)) installedTriggers += 1;
        continue;
      }

      throw new Error(`FAIL-CLOSED: unrecognized migration statement in ${file}: ${chunk.slice(0, 120)}`);
    }
  }

  const [[customerCount]] = await connection.query("SELECT COUNT(*) AS n FROM customers");
  if (Number(customerCount.n) !== 0) {
    throw new Error("FAIL-CLOSED: customers table is not empty");
  }

  const sensitiveTables = [
    "customer_dna",
    "dna_leads",
    "dna_availability_watch",
    "dna_runs",
    "cigar_research_pool",
    "orders",
    "customer_interactions",
  ];

  const nonEmptySensitive = [];
  for (const table of sensitiveTables) {
    const [exists] = await connection.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
      [EXPECTED_DB, table],
    );
    if (exists.length) {
      const [[count]] = await connection.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
      if (Number(count.n) !== 0) nonEmptySensitive.push({ table, rows: Number(count.n) });
    }
  }
  if (nonEmptySensitive.length) {
    throw new Error(`FAIL-CLOSED: sensitive staging tables contain data: ${JSON.stringify(nonEmptySensitive)}`);
  }

  const [tables] = await connection.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME",
    [EXPECTED_DB],
  );
  const [triggers] = await connection.query(
    "SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ? ORDER BY TRIGGER_NAME",
    [EXPECTED_DB],
  );

  console.log(JSON.stringify({
    database: EXPECTED_DB,
    executedSchemaStatements,
    installedTriggers,
    insertedSystemRows,
    skippedDataStatements,
    skippedDropTriggerGuards,
    tableCount: tables.length,
    triggerCount: triggers.length,
    customerRows: 0,
    sensitiveBusinessRows: 0,
  }, null, 2));
} finally {
  await connection.end();
}
