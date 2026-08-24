import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";

const EXPECTED_DATABASE = "bwljrj22_citicigars_staging";

async function counts(connection: mysql.Connection) {
  const tableNames = ["cigar_catalog", "cigar_dna_reviews", "cigar_research_pool", "cigar_research_pool_evidence", "dna_research_cases"];
  const output: Record<string, number | null> = {};
  for (const table of tableNames) {
    const [exists] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?",
      [table],
    );
    if (!exists.length) { output[table] = null; continue; }
    const [[row]] = await connection.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${table}\``);
    output[table] = Number(row.count);
  }
  return output;
}

async function main() {
  const write = process.argv.includes("--write");
  const url = process.env.MYSQL_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("MYSQL_URL ou DATABASE_URL requis");
  const connection = await mysql.createConnection({ uri: url, multipleStatements: true, ssl: false });
  try {
    const [[database]] = await connection.query<mysql.RowDataPacket[]>("SELECT DATABASE() AS name");
    if (database.name !== EXPECTED_DATABASE) throw new Error(`STOP_WRONG_DATABASE: ${database.name ?? "NULL"}`);
    const before = await counts(connection);
    if (!write) {
      const [columns] = await connection.query<mysql.RowDataPacket[]>(`
        SELECT table_name,column_name,column_type,character_set_name,collation_name
        FROM information_schema.columns
        WHERE table_schema=DATABASE()
          AND ((table_name='cigar_catalog' AND column_name IN ('cigar_id','pool_id'))
            OR (table_name='cigar_research_pool' AND column_name IN ('pool_id','canonical_cigar_id')))
        ORDER BY table_name,column_name
      `);
      console.log(JSON.stringify({ database: database.name, status: "DRY_RUN", before, columns }, null, 2));
      return;
    }
    const [complete] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT 1
      FROM information_schema.tables p
      JOIN information_schema.tables e ON e.table_schema=p.table_schema AND e.table_name='cigar_research_pool_evidence'
      JOIN information_schema.tables d ON d.table_schema=p.table_schema AND d.table_name='dna_research_cases'
      JOIN information_schema.columns c ON c.table_schema=p.table_schema AND c.table_name='cigar_catalog' AND c.column_name='pool_id'
      WHERE p.table_schema=DATABASE() AND p.table_name='cigar_research_pool'
    `);
    if (complete.length) {
      const [[technicalKey]] = await connection.query<mysql.RowDataPacket[]>(`
        SELECT collation_name FROM information_schema.columns
        WHERE table_schema=DATABASE() AND table_name='cigar_research_pool' AND column_name='technical_key'
      `);
      let status = "ALREADY_APPLIED";
      if (technicalKey.collation_name !== "utf8mb4_bin") {
        await connection.query(`
          ALTER TABLE cigar_research_pool
          MODIFY technical_key varchar(700) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
        `);
        status = "REPAIRED_TECHNICAL_KEY_COLLATION";
      }
      const after = await counts(connection);
      console.log(JSON.stringify({ database: database.name, status, before, after }, null, 2));
      return;
    }
    const [catalogPoolColumn] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema=DATABASE() AND table_name='cigar_catalog' AND column_name='pool_id'
    `);
    if (
      before.cigar_research_pool !== null &&
      before.cigar_research_pool_evidence !== null &&
      before.dna_research_cases === null &&
      catalogPoolColumn.length
    ) {
      const sql = await fs.readFile(path.resolve("migrations-mysql/0015_research_pool.sql"), "utf8");
      const casesOnly = sql.slice(sql.indexOf("CREATE TABLE `dna_research_cases`"));
      await connection.query(casesOnly);
      const after = await counts(connection);
      console.log(JSON.stringify({ database: database.name, status: "RESUMED", before, after }, null, 2));
      return;
    }
    if (before.cigar_research_pool !== null || before.cigar_research_pool_evidence !== null) {
      if ((before.cigar_research_pool ?? 0) !== 0 || (before.cigar_research_pool_evidence ?? 0) !== 0) {
        throw new Error("STOP_PARTIAL_MIGRATION_WITH_DATA");
      }
      // Reprise sûre d'un DDL partiel : seules les deux tables 0015 vides,
      // créées par l'essai interrompu avant ALTER cigar_catalog, sont retirées.
      await connection.query("DROP TABLE IF EXISTS cigar_research_pool_evidence");
      await connection.query("DROP TABLE IF EXISTS cigar_research_pool");
    }
    const sql = await fs.readFile(path.resolve("migrations-mysql/0015_research_pool.sql"), "utf8");
    await connection.query(sql);
    const after = await counts(connection);
    console.log(JSON.stringify({ database: database.name, status: "APPLIED", before, after }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
