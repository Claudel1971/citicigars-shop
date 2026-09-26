import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const EXPECTED_DB = "bwljrj22_citicigars_admin_staging";
const url = process.env.MYSQL_URL;
if (!url) throw new Error("MYSQL_URL missing");

const parsed = new URL(url);
const database = parsed.pathname.replace(/^\//, "");
if (database !== EXPECTED_DB) {
  throw new Error(`FAIL-CLOSED: expected staging DB ${EXPECTED_DB}, got ${database || "<empty>"}`);
}

const connection = await mysql.createConnection(url);
try {
  const [[dbRow]] = await connection.query("SELECT DATABASE() AS db");
  if (dbRow.db !== EXPECTED_DB) {
    throw new Error(`FAIL-CLOSED: connected to unexpected DB ${dbRow.db}`);
  }

  const migrationsDir = path.resolve("migrations-mysql");
  const files = (await fs.readdir(migrationsDir))
    .filter((name) => /^\d.*\.sql$/.test(name))
    .sort();

  let triggerCount = 0;
  let systemInsertCount = 0;

  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    const chunks = sql
      .split("--> statement-breakpoint")
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    for (let chunk of chunks) {
      const triggerMatch = chunk.match(/CREATE\s+TRIGGER\s+`([^`]+)`/i);
      if (triggerMatch) {
        const triggerName = triggerMatch[1];
        await connection.query(`DROP TRIGGER IF EXISTS \`${triggerName}\``);
        await connection.query(chunk);
        triggerCount += 1;
        continue;
      }

      if (/^DROP\s+TRIGGER/i.test(chunk.replace(/^--[^\n]*\n/gm, "").trim())) {
        continue;
      }

      const isLegacyLocation =
        /INSERT\s+INTO\s+`stock_locations`/i.test(chunk) &&
        /LEGACY_UNKNOWN/i.test(chunk);
      const isLegacyLot =
        /INSERT\s+INTO\s+`stock_provenance_lots`/i.test(chunk) &&
        /LEGACY_UNKNOWN/i.test(chunk);

      if (isLegacyLocation || isLegacyLot) {
        chunk = chunk.replace(/INSERT\s+INTO/i, "INSERT IGNORE INTO");
        await connection.query(chunk);
        systemInsertCount += 1;
      }
    }
  }

  const [[customerCount]] = await connection.query("SELECT COUNT(*) AS n FROM customers");
  if (Number(customerCount.n) !== 0) {
    throw new Error("FAIL-CLOSED: staging customers table is not empty");
  }

  const dnaTables = [
    "customer_dna",
    "dna_leads",
    "dna_availability_watch",
    "dna_runs",
    "cigar_research_pool",
  ];

  for (const table of dnaTables) {
    const [exists] = await connection.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
      [EXPECTED_DB, table],
    );
    if (exists.length) {
      const [[count]] = await connection.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
      if (Number(count.n) !== 0) {
        throw new Error(`FAIL-CLOSED: DNA staging table ${table} unexpectedly contains data`);
      }
    }
  }

  const [triggers] = await connection.query(
    "SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ? ORDER BY TRIGGER_NAME",
    [EXPECTED_DB],
  );

  console.log(JSON.stringify({
    database: EXPECTED_DB,
    triggerDefinitionsApplied: triggerCount,
    systemRowsApplied: systemInsertCount,
    installedTriggers: triggers.map((row) => row.TRIGGER_NAME),
    customerRows: 0,
    dnaDataRows: 0,
  }, null, 2));
} finally {
  await connection.end();
}
