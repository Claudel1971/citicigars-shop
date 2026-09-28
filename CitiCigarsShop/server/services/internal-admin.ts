import { randomUUID } from "node:crypto";
import type { PoolConnection } from "mysql2/promise";
import { mysqlPool } from "../db.mysql";
import {
  nextBusinessCode,
  sheetInput,
  taskInput,
  taskTransition,
} from "./internal-admin-model";
export class InternalAdminError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function identifiers(kind: "CUST" | "SUPP") {
  const [rows] = await mysqlPool.query<any[]>(
    "SELECT entity_id entityId,business_id businessId FROM admin_business_identifiers WHERE kind=?",
    [kind],
  );
  return rows;
}
// Stable persisted assignment. One mutex row per kind; concurrent syncs cannot allocate twice.
export async function syncIdentifiers(
  connection: PoolConnection,
  kind: "CUST" | "SUPP",
) {
  const [counter] = await connection.query<any[]>(
    "SELECT next_value n FROM admin_business_sequences WHERE kind=? FOR UPDATE",
    [kind],
  );
  if (!counter.length) throw new Error("Migration 0024 requise");
  const query =
    kind === "CUST"
      ? "SELECT customer_id id,created_at FROM customers ORDER BY created_at,customer_id"
      : "SELECT supplier_id id,created_at FROM stock_suppliers ORDER BY created_at,supplier_id";
  const [entities] = await connection.query<any[]>(query);
  const [existing] = await connection.query<any[]>(
    "SELECT entity_id,business_id FROM admin_business_identifiers WHERE kind=?",
    [kind],
  );
  const byEntity = new Map(existing.map((r) => [r.entity_id, r.business_id]));
  const used = new Set(existing.map((r) => r.business_id));
  const canonical = new RegExp(`^CTCG-${kind}-\\d{6}$`);
  let next = Math.max(1, Number(counter[0].n));
  // Reserve original business codes before assigning any legacy UUIDs.
  for (const entity of entities)
    if (canonical.test(entity.id)) {
      next = Math.max(next, Number(entity.id.slice(-6)) + 1);
      if (!byEntity.has(entity.id)) {
        if (used.has(entity.id))
          throw new Error("Collision avec une identité métier historique");
        await connection.query(
          "INSERT INTO admin_business_identifiers(kind,entity_id,business_id) VALUES (?,?,?)",
          [kind, entity.id, entity.id],
        );
        byEntity.set(entity.id, entity.id);
        used.add(entity.id);
      }
    }
  for (const entity of entities)
    if (!byEntity.has(entity.id)) {
      let code = nextBusinessCode(kind, next++);
      while (used.has(code)) code = nextBusinessCode(kind, next++);
      await connection.query(
        "INSERT INTO admin_business_identifiers(kind,entity_id,business_id) VALUES (?,?,?)",
        [kind, entity.id, code],
      );
      used.add(code);
    }
  await connection.query(
    "UPDATE admin_business_sequences SET next_value=? WHERE kind=?",
    [next, kind],
  );
  return entities.length;
}
export async function syncAllIdentifiers() {
  const c = await mysqlPool.getConnection();
  try {
    await c.beginTransaction();
    const counts = {
      customers: await syncIdentifiers(c, "CUST"),
      suppliers: await syncIdentifiers(c, "SUPP"),
    };
    await c.commit();
    return counts;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
export async function listInternalSheets(cigarId: string) {
  const [rows] = await mysqlPool.query<any[]>(
    "SELECT version_id versionId,cigar_id cigarId,source,source_date sourceDate,original_text originalText,fields_json fields,created_by createdBy,created_at createdAt FROM admin_technical_sheet_versions WHERE cigar_id=? ORDER BY created_at DESC,version_id DESC",
    [cigarId],
  );
  const [legacy] = await mysqlPool.query<any[]>(
    "SELECT sku,fiche_technique,updated_at FROM products WHERE cigar_id=? AND fiche_technique IS NOT NULL",
    [cigarId],
  );
  return [
    ...rows,
    ...legacy.map((r) => {
      const f =
        typeof r.fiche_technique === "string"
          ? JSON.parse(r.fiche_technique)
          : r.fiche_technique;
      return {
        versionId: "legacy-" + r.sku,
        cigarId,
        source: "Fiche historique — source non renseignée",
        sourceDate: null,
        createdAt: r.updated_at,
        createdBy: "Historique",
        originalText: JSON.stringify(f, null, 2),
        fields: {
          origin: f?.terroir?.origine ?? "",
          wrapper: f?.terroir?.cape ?? "",
          binder: f?.terroir?.sousCape ?? "",
          filler: f?.terroir?.tripe ?? "",
          format: "",
          dimensions: "",
        },
        legacy: true,
      };
    }),
  ];
}
export async function addInternalSheet(input: unknown, actor: string) {
  const data = sheetInput.parse(input);
  const [identity] = await mysqlPool.query<any[]>(
    "SELECT cigar_id FROM cigar_catalog WHERE cigar_id=?",
    [data.cigarId],
  );
  if (!identity.length) throw new InternalAdminError(404, "Identité inconnue");
  const versionId = randomUUID();
  await mysqlPool.query(
    "INSERT INTO admin_technical_sheet_versions(version_id,cigar_id,source,source_date,original_text,fields_json,created_by) VALUES (?,?,?,?,?,?,?)",
    [
      versionId,
      data.cigarId,
      data.source,
      data.sourceDate,
      data.originalText,
      JSON.stringify(data.fields),
      actor,
    ],
  );
  return { versionId };
}
export async function listAdminTasks(customerId?: string) {
  const [rows] = await mysqlPool.query<any[]>(
    `SELECT t.task_id taskId,t.customer_id customerId,t.category,t.due_at dueAt,t.responsible,t.status,t.version,t.created_at createdAt,t.updated_at updatedAt,c.first_name firstName,c.last_name lastName,b.business_id businessId FROM admin_tasks t JOIN customers c ON c.customer_id=t.customer_id LEFT JOIN admin_business_identifiers b ON b.kind='CUST' AND b.entity_id=t.customer_id ${customerId ? "WHERE t.customer_id=?" : ""} ORDER BY t.due_at,t.task_id`,
    customerId ? [customerId] : [],
  );
  return rows;
}
export async function createAdminTask(input: unknown, actor: string) {
  const data = taskInput.parse(input),
    c = await mysqlPool.getConnection(),
    taskId = randomUUID();
  try {
    await c.beginTransaction();
    const [customer] = await c.query<any[]>(
      "SELECT customer_id FROM customers WHERE customer_id=? FOR UPDATE",
      [data.customerId],
    );
    if (!customer.length) throw new InternalAdminError(404, "Client inconnu");
    await c.query(
      "INSERT INTO admin_tasks(task_id,customer_id,category,due_at,responsible,created_by) VALUES (?,?,?,?,?,?)",
      [
        taskId,
        data.customerId,
        data.category,
        data.dueAt,
        data.responsible,
        actor,
      ],
    );
    await c.query(
      "INSERT INTO admin_task_events(event_id,task_id,status,actor,version) VALUES (?,?,'OPEN',?,1)",
      [randomUUID(), taskId, actor],
    );
    await c.commit();
    return { taskId };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
export async function transitionAdminTask(
  taskId: string,
  input: unknown,
  actor: string,
) {
  const data = taskTransition.parse(input),
    c = await mysqlPool.getConnection();
  try {
    await c.beginTransaction();
    const [rows] = await c.query<any[]>(
      "SELECT version,status FROM admin_tasks WHERE task_id=? FOR UPDATE",
      [taskId],
    );
    if (!rows.length) throw new InternalAdminError(404, "Tâche inconnue");
    if (rows[0].version !== data.version)
      throw new InternalAdminError(409, "Tâche modifiée : actualisez la liste");
    if (rows[0].status === data.status) {
      await c.commit();
      return { version: data.version };
    }
    const version = data.version + 1;
    await c.query("UPDATE admin_tasks SET status=?,version=? WHERE task_id=?", [
      data.status,
      version,
      taskId,
    ]);
    await c.query(
      "INSERT INTO admin_task_events(event_id,task_id,status,actor,version) VALUES (?,?,?,?,?)",
      [randomUUID(), taskId, data.status, actor, version],
    );
    await c.commit();
    return { version };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
