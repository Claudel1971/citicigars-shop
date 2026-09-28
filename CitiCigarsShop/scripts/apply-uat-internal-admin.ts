/** Staging operator CLI, never called by HTTP or normal application startup. */
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
const option = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const expected = "bwljrj22_citicigars_admin_staging";
const url = process.env.MYSQL_URL;
if (!url || new URL(url).pathname !== `/${expected}`)
  throw new Error("Isolated CitiCigars staging database required");
if (
  !process.argv.includes("--apply") ||
  !process.argv.includes("--administrative-writes-paused")
)
  throw new Error(
    "Explicit apply and paused-administrative-writes confirmation required",
  );
const backupPath = option("backup-file"),
  backupSha = option("backup-sha256");
if (!backupPath || !backupSha)
  throw new Error("Verified backup path and SHA256 required");
const backup = await fs.readFile(backupPath),
  stat = await fs.stat(backupPath);
if (
  Date.now() - stat.mtimeMs > 3600000 ||
  createHash("sha256").update(backup).digest("hex") !== backupSha
)
  throw new Error("Backup expired or hash mismatch");
const restored = gunzipSync(backup).toString("utf8");
if (
  !restored.includes(`-- Database: ${expected}`) ||
  !restored.includes("CREATE TABLE `customers`") ||
  !restored.includes("SET FOREIGN_KEY_CHECKS=1;")
)
  throw new Error("Backup database/content mismatch");
const { mysqlPool } = await import("../server/db.mysql");
const { syncAllIdentifiers } = await import(
  "../server/services/internal-admin"
);
try {
  const [db] = await mysqlPool.query<any[]>("SELECT DATABASE() name");
  if (db[0].name !== expected) throw new Error("Database mismatch");
  const sql = await fs.readFile(
    "migrations-mysql/0024_uat_internal_admin.sql",
    "utf8",
  );
  for (const statement of sql.split(";").filter((s) => s.trim()))
    await mysqlPool.query(statement);
  await syncAllIdentifiers();
  const triggers = (
    await fs.readFile(
      "migrations-mysql/0024b_uat_identifier_triggers.sql",
      "utf8",
    )
  ).split("--> statement-breakpoint");
  for (const statement of triggers) {
    const name = statement.match(/CREATE TRIGGER (\w+)/)?.[1];
    const [existing] = await mysqlPool.query<any[]>(
      "SELECT TRIGGER_NAME name FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME=?",
      [name],
    );
    if (!existing.length) await mysqlPool.query(statement);
  }
  console.log(
    JSON.stringify({
      migration: "0024",
      database: expected,
      backupSha256: backupSha,
      status: "APPLIED",
    }),
  );
} finally {
  await mysqlPool.end();
}
