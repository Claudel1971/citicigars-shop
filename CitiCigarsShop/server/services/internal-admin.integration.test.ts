import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import mysql from "mysql2/promise";
let admin: mysql.Connection,
  pool: mysql.Pool,
  service: typeof import("./internal-admin");
const database =
  "citicigars_uat_" + randomUUID().replaceAll("-", "").slice(0, 12);
beforeAll(async () => {
  const url = new URL(process.env.MYSQL_URL!);
  if (url.pathname !== "/citicigars_ci") throw new Error("Ephemeral CI only");
  admin = await mysql.createConnection(url.toString());
  await admin.query(`CREATE DATABASE ${database}`);
  url.pathname = "/" + database;
  process.env.MYSQL_URL = url.toString();
  ({ mysqlPool: pool } = await import("../db.mysql"));
  service = await import("./internal-admin");
  await pool.query(
    "CREATE TABLE customers(customer_id VARCHAR(36) PRIMARY KEY,first_name VARCHAR(255),last_name VARCHAR(255),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
  );
  await pool.query(
    "CREATE TABLE stock_suppliers(supplier_id VARCHAR(36) PRIMARY KEY,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
  );
  await pool.query(
    "CREATE TABLE products(sku VARCHAR(50) PRIMARY KEY,cigar_id VARCHAR(20),fiche_technique JSON,updated_at TIMESTAMP)",
  );
  await pool.query(
    "CREATE TABLE cigar_catalog(cigar_id VARCHAR(20) PRIMARY KEY)",
  );
  const ddl = await fs.readFile(
    "migrations-mysql/0024_uat_internal_admin.sql",
    "utf8",
  );
  for (const q of ddl.split(";").filter((s) => s.trim())) await pool.query(q);
  await pool.query(
    "INSERT INTO customers(customer_id) VALUES ('legacy-a'),('CTCG-CUST-000004')",
  );
  await pool.query(
    "INSERT INTO stock_suppliers(supplier_id) VALUES ('legacy-s')",
  );
  await service.syncAllIdentifiers();
  const triggers = await fs.readFile(
    "migrations-mysql/0024b_uat_identifier_triggers.sql",
    "utf8",
  );
  for (const q of triggers.split("--> statement-breakpoint"))
    await pool.query(q);
  await pool.query(
    "INSERT INTO cigar_catalog(cigar_id) VALUES ('CI-INTERNAL-1')",
  );
});
afterAll(async () => {
  if (pool) await pool.end();
  if (admin) {
    await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
});
describe("additive internal admin on isolated MySQL", () => {
  it("preserves original IDs and assigns deterministic persisted legacy codes", async () => {
    const before = await service.identifiers("CUST");
    expect(before).toContainEqual({
      entityId: "legacy-a",
      businessId: "CTCG-CUST-000005",
    });
    expect(before).toContainEqual({
      entityId: "CTCG-CUST-000004",
      businessId: "CTCG-CUST-000004",
    });
    await Promise.all([
      service.syncAllIdentifiers(),
      service.syncAllIdentifiers(),
    ]);
    expect(await service.identifiers("CUST")).toEqual(before);
  });
  it("assigns unique new identifiers atomically even when a technical PK resembles an allocated business code", async () => {
    await pool.query(
      "INSERT INTO customers(customer_id) VALUES ('CTCG-CUST-000005')",
    );
    expect(await service.identifiers("CUST")).toContainEqual({
      entityId: "CTCG-CUST-000005",
      businessId: "CTCG-CUST-000006",
    });
    const c = await pool.getConnection();
    await c.beginTransaction();
    await c.query(
      "INSERT INTO stock_suppliers(supplier_id) VALUES ('rolled-back')",
    );
    await c.rollback();
    c.release();
    expect(
      (await service.identifiers("SUPP")).some(
        (r) => r.entityId === "rolled-back",
      ),
    ).toBe(false);
    await Promise.all(
      ["s1", "s2", "s3"].map((id) =>
        pool.query("INSERT INTO stock_suppliers(supplier_id) VALUES (?)", [id]),
      ),
    );
    const codes = (await service.identifiers("SUPP")).map((r) => r.businessId);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("records task transitions once and refuses stale concurrent changes", async () => {
    const { taskId } = await service.createAdminTask(
      {
        customerId: "legacy-a",
        category: "ADMIN_DOCUMENT",
        dueAt: "2026-09-28",
        responsible: "Test operator",
      },
      "OWNER",
    );
    await service.transitionAdminTask(
      taskId,
      { status: "DONE", version: 1 },
      "OWNER",
    );
    await expect(
      service.transitionAdminTask(
        taskId,
        { status: "CANCELLED", version: 1 },
        "OWNER",
      ),
    ).rejects.toMatchObject({ status: 409 });
    await service.transitionAdminTask(
      taskId,
      { status: "OPEN", version: 2 },
      "OWNER",
    );
    const [events] = await pool.query<any[]>(
      "SELECT status FROM admin_task_events WHERE task_id=? ORDER BY version",
      [taskId],
    );
    expect(events.map((e) => e.status)).toEqual(["OPEN", "DONE", "OPEN"]);
    expect((await service.listAdminTasks("legacy-a"))[0].responsible).toBe(
      "Test operator",
    );
  });
  it("keeps factual sheet source versions separate from public products", async () => {
    const input = {
      cigarId: "CI-INTERNAL-1",
      source: "Synthetic CI document",
      sourceDate: null,
      originalText: "Origine : Example",
      fields: {
        origin: "Example",
        wrapper: "",
        binder: "",
        filler: "",
        format: "",
        dimensions: "",
      },
    };
    await service.addInternalSheet(input, "OWNER");
    await service.addInternalSheet(
      { ...input, source: "Second source" },
      "OWNER",
    );
    const versions = await service.listInternalSheets(input.cigarId);
    expect(versions).toHaveLength(2);
    expect(new Set(versions.map((v) => v.source)).size).toBe(2);
    await expect(
      service.addInternalSheet({ ...input, cigarId: "absent" }, "OWNER"),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("rolls back additive tables by archiving them without changing historical entity rows",async()=>{
    const [before]=await pool.query<any[]>('SELECT customer_id FROM customers ORDER BY customer_id');
    const rollback=await fs.readFile('migrations-mysql/0024_uat_internal_admin.rollback.sql','utf8');
    for(const q of rollback.split(';').filter(q=>/\b(DROP TRIGGER|RENAME TABLE)\b/.test(q)))await pool.query(q);
    const [after]=await pool.query<any[]>('SELECT customer_id FROM customers ORDER BY customer_id');expect(after).toEqual(before);
    const [archived]=await pool.query<any[]>('SELECT COUNT(*) n FROM rollback_0024_sheet_versions');expect(Number(archived[0].n)).toBe(2);
  });

});
