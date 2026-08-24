import process from "node:process";
import mysql from "mysql2/promise";

const EXPECTED_DATABASE = "bwljrj22_citicigars_staging";
const KEEP_ID = "CTG000547";
const REMOVE_ID = "CTG000569";

function quoteIdentifier(value: string): string {
  return `\`${value.replaceAll("`", "``")}\``;
}

async function main() {
  const write = process.argv.includes("--write");
  const url = process.env.MYSQL_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("MYSQL_URL ou DATABASE_URL requis");

  const connection = await mysql.createConnection({ uri: url, ssl: false });
  try {
    const [[database]] = await connection.query<mysql.RowDataPacket[]>("SELECT DATABASE() AS name");
    if (database.name !== EXPECTED_DATABASE) {
      throw new Error(`STOP_WRONG_DATABASE: ${database.name ?? "NULL"}`);
    }

    const [catalog] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT cigar_id, marque, ligne, vitole, format, dimensions, pool_id
      FROM cigar_catalog
      WHERE cigar_id IN (?, ?)
      ORDER BY cigar_id
    `, [KEEP_ID, REMOVE_ID]);

    const [pool] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT pool_id, source_cigar_id, canonical_cigar_id, brand, line, vitole,
             format, dimensions, technical_key
      FROM cigar_research_pool
      WHERE source_cigar_id IN (?, ?)
         OR canonical_cigar_id IN (?, ?)
         OR pool_id IN (
           SELECT pool_id FROM cigar_catalog WHERE cigar_id IN (?, ?)
         )
      ORDER BY pool_id
    `, [KEEP_ID, REMOVE_ID, KEEP_ID, REMOVE_ID, KEEP_ID, REMOVE_ID]);

    const [foreignKeys] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT kcu.TABLE_NAME, kcu.COLUMN_NAME, rc.CONSTRAINT_NAME,
             rc.DELETE_RULE, rc.UPDATE_RULE
      FROM information_schema.REFERENTIAL_CONSTRAINTS rc
      JOIN information_schema.KEY_COLUMN_USAGE kcu
        ON kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
       AND kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
       AND kcu.TABLE_NAME = rc.TABLE_NAME
      WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
        AND rc.REFERENCED_TABLE_NAME = 'cigar_catalog'
        AND kcu.REFERENCED_COLUMN_NAME = 'cigar_id'
      ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME
    `);

    const dependencies = [];
    for (const foreignKey of foreignKeys) {
      const table = quoteIdentifier(String(foreignKey.TABLE_NAME));
      const column = quoteIdentifier(String(foreignKey.COLUMN_NAME));
      const [counts] = await connection.query<mysql.RowDataPacket[]>(`
        SELECT ${column} AS cigar_id, COUNT(*) AS count
        FROM ${table}
        WHERE ${column} IN (?, ?)
        GROUP BY ${column}
        ORDER BY ${column}
      `, [KEEP_ID, REMOVE_ID]);
      dependencies.push({
        table: foreignKey.TABLE_NAME,
        column: foreignKey.COLUMN_NAME,
        deleteRule: foreignKey.DELETE_RULE,
        updateRule: foreignKey.UPDATE_RULE,
        counts: counts.map((row) => ({ cigarId: row.cigar_id, count: Number(row.count) })),
      });
    }

    const poolIds = catalog.map((row) => row.pool_id).filter(Boolean);
    const poolDependencies = [];
    for (const poolId of poolIds) {
      const [[evidence]] = await connection.query<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM cigar_research_pool_evidence WHERE pool_id = ?",
        [poolId],
      );
      const [[cases]] = await connection.query<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM dna_research_cases WHERE pool_id = ?",
        [poolId],
      );
      poolDependencies.push({ poolId, evidence: Number(evidence.count), cases: Number(cases.count) });
    }

    if (write) {
      const keep = catalog.find((row) => row.cigar_id === KEEP_ID);
      const remove = catalog.find((row) => row.cigar_id === REMOVE_ID);
      if (!keep || !remove || catalog.length !== 2) throw new Error("STOP_EXPECTED_CATALOG_ROWS_MISSING");
      if (keep.format !== "Toro" || remove.format !== "Belicoso") throw new Error("STOP_UNEXPECTED_FORMATS");
      for (const field of ["marque", "ligne", "vitole", "dimensions"] as const) {
        if (keep[field] !== remove[field]) throw new Error(`STOP_PRODUCTS_DIFFER_ON_${field.toUpperCase()}`);
      }
      if (!keep.pool_id || !remove.pool_id || keep.pool_id === remove.pool_id) {
        throw new Error("STOP_UNEXPECTED_POOL_LINKS");
      }
      const removePool = poolDependencies.find((row) => row.poolId === remove.pool_id);
      if (!removePool || removePool.evidence !== 0 || removePool.cases !== 0) {
        throw new Error("STOP_REMOVE_POOL_HAS_DEPENDENCIES");
      }
      const unexpectedDependencies = dependencies.filter((dependency) =>
        dependency.table !== "cigar_research_pool" &&
        dependency.counts.some((count) => count.cigarId === REMOVE_ID && count.count > 0),
      );
      if (unexpectedDependencies.length) throw new Error("STOP_REMOVE_ID_HAS_EXTERNAL_DEPENDENCIES");

      await connection.beginTransaction();
      try {
        const [lockedCatalog] = await connection.query<mysql.RowDataPacket[]>(
          "SELECT cigar_id FROM cigar_catalog WHERE cigar_id IN (?, ?) FOR UPDATE",
          [KEEP_ID, REMOVE_ID],
        );
        if (lockedCatalog.length !== 2) throw new Error("STOP_CONCURRENT_CATALOG_CHANGE");
        const [deletedCatalog] = await connection.execute<mysql.ResultSetHeader>(
          "DELETE FROM cigar_catalog WHERE cigar_id = ?",
          [REMOVE_ID],
        );
        const [deletedPool] = await connection.execute<mysql.ResultSetHeader>(
          "DELETE FROM cigar_research_pool WHERE pool_id = ? AND canonical_cigar_id IS NULL",
          [remove.pool_id],
        );
        if (deletedCatalog.affectedRows !== 1 || deletedPool.affectedRows !== 1) {
          throw new Error("STOP_UNEXPECTED_DELETE_COUNTS");
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }

      const [[verification]] = await connection.query<mysql.RowDataPacket[]>(`
        SELECT
          SUM(cigar_id = ?) AS kept_catalog,
          SUM(cigar_id = ?) AS removed_catalog,
          COUNT(*) AS catalog_count
        FROM cigar_catalog
      `, [KEEP_ID, REMOVE_ID]);
      const [[poolVerification]] = await connection.query<mysql.RowDataPacket[]>(`
        SELECT
          SUM(pool_id = ?) AS kept_pool,
          SUM(pool_id = ?) AS removed_pool,
          COUNT(*) AS pool_count
        FROM cigar_research_pool
      `, [keep.pool_id, remove.pool_id]);
      console.log(JSON.stringify({
        database: database.name,
        mode: "WRITE_COMPLETE",
        kept: { cigarId: KEEP_ID, poolId: keep.pool_id },
        removed: { cigarId: REMOVE_ID, poolId: remove.pool_id },
        verification: {
          keptCatalog: Number(verification.kept_catalog),
          removedCatalog: Number(verification.removed_catalog),
          catalogCount: Number(verification.catalog_count),
          keptPool: Number(poolVerification.kept_pool),
          removedPool: Number(poolVerification.removed_pool),
          poolCount: Number(poolVerification.pool_count),
        },
      }, null, 2));
      return;
    }

    console.log(JSON.stringify({
      database: database.name,
      mode: "AUDIT_ONLY",
      keepId: KEEP_ID,
      removeId: REMOVE_ID,
      catalog,
      pool,
      dependencies,
      poolDependencies,
    }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
