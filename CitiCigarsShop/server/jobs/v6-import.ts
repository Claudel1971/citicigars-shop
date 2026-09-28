import { qualifyStagingViews } from "./v6-qualification";
import { importCommercial, importClosingAdjustment, validateCommercial } from "./v6-commercial";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { sql } from "drizzle-orm";
import { db, mysqlPool } from "../db.mysql";
import { createPurchaseOrder, createReceipt } from "../services/purchasing";
import { skus, stockSuppliers, stockLocations, cigarCatalog, packSizeConfig, accessories, stockProvenanceLots, stockLotCostBasis, MOVEMENT_TYPES } from "../../shared/schema.stock";
import { products } from "../../shared/schema.mysql";
import { stockStorage } from "../storage.stock";
import { bundles, bundleItems } from "../../shared/schema.bundles";

export const V6_DATABASE = "bwljrj22_citicigars_admin_staging";
const SERVICE = "srv-da15590u01pc739gdjrg";
const SOURCE_HASH = "48d8ea8523728b00cd0a2949c61302148309656a75ede590c32c709c1b77174a";
export const hash = (x: unknown) => createHash("sha256").update(typeof x === "string" ? x : JSON.stringify(x)).digest("hex");
export function stableId(value: string) { const h = hash(`V6:${value}`); return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; }
function refuse(code: string): never { throw Object.assign(new Error(code), { safeCode: code }); }
const rows = (result: any): any[] => result[0];
export const JOURNAL_DDL = `CREATE TABLE IF NOT EXISTS v6_import_journal (
 source_system VARCHAR(32) COLLATE utf8mb4_bin NOT NULL,
 source_record_id VARCHAR(190) COLLATE utf8mb4_bin NOT NULL,
 source_hash CHAR(64) NOT NULL, phase VARCHAR(8) NOT NULL,
 payload_json JSON NOT NULL, target_json JSON NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (source_system, source_record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

export interface V6Operation { source_record_id: string; phase: string; kind: "catalog" | "purchase" | "transform" | "opening" | "commercial" | "adjustment" | "reclass"; payload: any }
export interface V6Plan { version: 1; source_sha256: string; operations: V6Operation[]; blocked_phases: string[]; expected: any }

export function validatePlan(plan: V6Plan) {
  if (plan.version !== 1 || plan.source_sha256 !== SOURCE_HASH || !Array.isArray(plan.operations) || !plan.operations.length || plan.operations.length > 200) refuse("PLAN_SHAPE");
  const seen = new Set<string>();
  for (const op of plan.operations) {
    if (!/^MG:[A-Za-z0-9:_-]{1,185}$/.test(op.source_record_id) || seen.has(op.source_record_id)) refuse("SOURCE_ID");
    seen.add(op.source_record_id);
    if (op.kind === "catalog") {
      if (op.phase !== "PS1" || !Array.isArray(op.payload.skus) || !op.payload.skus.length) refuse("CATALOG_PLAN");
      for (const row of op.payload.skus) if (!/^CTCG-[A-Z0-9-]+$/.test(row.sku) || !["CIGAR","BUNDLE","ACCESSORY"].includes(row.kind)) refuse("SKU_PLAN");
    } else if (op.kind === "purchase") {
      if (op.phase !== "PS2" || !Array.isArray(op.payload.lines) || !op.payload.lines.length) refuse("PURCHASE_PLAN");
      const lines = new Set();
      if (op.payload.period && (!/^\d{4}-(0[1-9]|1[0-2])$/.test(op.payload.period) || op.payload.orderedAt || op.payload.receivedAt)) refuse("PARTIAL_DATE_PLAN");
      if (!op.payload.period && (!/^\d{4}-\d{2}-\d{2}$/.test(op.payload.orderedAt) || !/^\d{4}-\d{2}-\d{2}$/.test(op.payload.receivedAt))) refuse("DATE_PLAN");
      for (const row of op.payload.lines) {
        const key = `${row.sku}/${row.type}/${row.packSize}`;
        if (lines.has(key) || !Number.isInteger(row.quantity) || row.quantity <= 0 || !["Box","Pack","Accessory"].includes(row.type) || !Number.isInteger(row.packSize) || (row.type === "Pack" ? row.packSize <= 0 : row.packSize !== 0)) refuse("PURCHASE_LINE_PLAN");
        if (row.unitCostXaf != null && (!Number.isFinite(row.unitCostXaf) || row.unitCostXaf < 0)) refuse("COST_PLAN");
        lines.add(key);
      }
    } else if (op.kind === "transform") {
      if (op.phase !== "PS3") refuse("TRANSFORM_PHASE");
      validateTransform(op.payload);
    } else if (op.kind === "opening") {
      const p = op.payload;
      if (op.phase !== "PS3" || p.type !== "Accessory" || p.packSize !== 0 || !Number.isInteger(p.quantity) || p.quantity <= 0 || p.eventDate !== null || !p.reason || (p.unitCostXaf !== null && p.unitCostXaf !== 0)) refuse("OPENING_PLAN");
    } else if(op.kind==="commercial"){
      if(op.phase!=="PS4")refuse("COMMERCIAL_PHASE");validateCommercial(op.payload);
    } else if(op.kind==="adjustment"||op.kind==="reclass"){
      const p=op.payload;
      if(op.phase!=="PS5"||p.eventDate!==null||!p.reason||!/^CTCG-/.test(p.sku)||!["Pack","Box","Accessory"].includes(p.type))refuse("CLOSING_PLAN");
      if(op.kind==="adjustment"&&(!Number.isSafeInteger(p.delta)||p.delta>=0))refuse("CLOSING_DELTA");
      if(op.kind==="reclass"&&(!Number.isSafeInteger(p.quantity)||p.quantity<=0||!p.depositLocationCode))refuse("RECLASS_PLAN");
    } else refuse("UNIMPLEMENTED_OPERATION");
  }
}

export function validateJobEnvironment(env: NodeJS.ProcessEnv, now: number) {
  if (env.V6_WRITE_ENABLED !== "true") return null;
  if (env.RENDER !== "true" || env.RENDER_SERVICE_ID !== SERVICE || env.RENDER_SERVICE_NAME !== "citicigars-api-staging") refuse("SERVICE_GUARD");
  if (!/^[a-f0-9]{40}$/.test(env.V6_WRITE_COMMIT || "") || env.RENDER_GIT_COMMIT !== env.V6_WRITE_COMMIT) refuse("COMMIT_GUARD");
  const expires = Date.parse(env.V6_WRITE_EXPIRES_AT || "");
  if (!Number.isFinite(expires) || expires <= now || expires - now > 7200000) refuse("EXPIRY_GUARD");
  let url: URL;
  try { url = new URL(env.MYSQL_URL || ""); } catch { refuse("URL_GUARD"); }
  if (url!.protocol !== "mysql:" || decodeURIComponent(url!.pathname.slice(1)) !== V6_DATABASE || url!.search || url!.hash) refuse("DATABASE_GUARD");
  const mode = env.V6_WRITE_MODE;
  if (!["dry-run","migrate","apply","reconcile","qualify"].includes(mode || "")) refuse("MODE_GUARD");
  let bytes: Buffer, plan: V6Plan;
  try {
    if ((env.V6_WRITE_PLAN_GZIP || "").length > 150000) refuse("PLAN_SIZE");
    bytes = gunzipSync(Buffer.from(env.V6_WRITE_PLAN_GZIP || "", "base64"), { maxOutputLength: 1000000 });
    plan = JSON.parse(bytes.toString("utf8"));
  } catch { refuse("PLAN_DECODE"); }
  if (hash(bytes!.toString("utf8")) !== env.V6_WRITE_PLAN_SHA256) refuse("PLAN_HASH");
  validatePlan(plan!);
  if (["migrate","apply"].includes(mode!) && !/^[a-f0-9]{64}$/.test(env.V6_WRITE_EXPECTED_BASELINE || "")) refuse("APPROVED_BASELINE_REQUIRED");
  if (["migrate","apply"].includes(mode!) && !/^[a-f0-9]{64}$/.test(env.V6_WRITE_EXPECTED_SCHEMA || "")) refuse("APPROVED_SCHEMA_REQUIRED");
  const max = Number(env.V6_WRITE_MAX_OPERATIONS || "1");
  if (!Number.isInteger(max) || max < 1 || max > 10) refuse("BATCH_LIMIT");
  return { plan: plan!, mode: mode!, expires, max };
}

export async function assertDatabase(reader: any, expected = V6_DATABASE) {
  const result = rows(await reader.execute(sql`SELECT DATABASE() AS name`));
  if (result[0]?.name !== expected) refuse("LIVE_DATABASE_GUARD");
}

export async function journalOperation(executor: any, op: V6Operation, adapter: (tx: any) => Promise<unknown>, expectedDatabase = V6_DATABASE) {
  return executor.transaction(async (tx: any) => {
    await assertDatabase(tx, expectedDatabase);
    const previous = rows(await tx.execute(sql`SELECT source_hash, target_json FROM v6_import_journal WHERE source_system='MASTER_GESTION' AND source_record_id=${op.source_record_id} FOR UPDATE`));
    const operationHash = hash(op);
    if (previous.length) {
      if (previous[0].source_hash !== operationHash) refuse("SOURCE_HASH_CONFLICT");
      return { replay: true, target: typeof previous[0].target_json === "string" ? JSON.parse(previous[0].target_json) : previous[0].target_json };
    }
    const target = await adapter(tx);
    await tx.execute(sql`INSERT INTO v6_import_journal (source_system, source_record_id, source_hash, phase, payload_json, target_json) VALUES ('MASTER_GESTION',${op.source_record_id},${operationHash},${op.phase},${JSON.stringify(op.payload)},${JSON.stringify(target)})`);
    return { replay: false, target };
  });
}

export async function importCatalog(tx: any, op: V6Operation) {
  const p = op.payload;
  await tx.insert(stockLocations).values({ locationId: stableId("location:unknown"), code: "V6_LEGACY_UNKNOWN", name: "V6 — lieu historique inconnu", category: "OTHER", active: true, isSystem: false, notes: "Absence de preuve de localisation physique historique." });
  for (const supplier of p.suppliers) await tx.insert(stockSuppliers).values({ supplierId: stableId(`supplier:${supplier.code}`), ...supplier });
  for (const c of p.cigars) await tx.insert(cigarCatalog).values(c);
  for (const row of p.skus) {
    await tx.insert(skus).values({ sku: row.sku, kind: row.kind });
    if (row.kind === "CIGAR") await tx.insert(products).values(row.product);
    if (row.kind === "BUNDLE") await tx.insert(bundles).values(row.bundle);
    if (row.kind === "ACCESSORY") await tx.insert(accessories).values(row.accessory);
    for (const packSize of row.packSizes || []) await tx.insert(packSizeConfig).values({ sku: row.sku, packSize, active: true });
  }
  return { skuCount: p.skus.length, supplierCount: p.suppliers.length };
}

export async function importPurchase(tx: any, op: V6Operation) {
  const p = op.payload;
  const context = { executor: tx, period: p.period || undefined };
  const notes = JSON.stringify({ source_record_id: op.source_record_id, date_precision: p.period ? "MONTH" : "DAY", period: p.period || null, costing: p.costingMethod, source: "MASTER_GESTION_V6" });
  const po: any = await createPurchaseOrder({ clientRequestId: stableId(`${op.source_record_id}:po`), supplierId: stableId(`supplier:${p.supplierCode}`), orderedAt: p.orderedAt || "", notes, createdBy: "V6_IMPORT", purchaseReference: p.reference,
    lines: p.lines.map((l: any) => ({ sku: l.sku, type: l.type, packSize: l.packSize, orderedQuantity: l.quantity })) }, context);
  const receipt: any = await createReceipt({ clientRequestId: stableId(`${op.source_record_id}:receipt`), purchaseOrderId: po.purchaseOrderId, destinationLocationId: stableId("location:unknown"), receivedAt: p.receivedAt || "", author: "V6_IMPORT", notes, invoiceReference: p.reference,
    lines: p.lines.map((l: any) => {
      const item = po.items.find((x: any) => x.sku === l.sku && x.type === l.type && x.packSize === l.packSize);
      if (!item) refuse("PO_LINE_MAPPING");
      return { sku: l.sku, type: l.type, packSize: l.packSize, purchaseOrderItemId: item.purchaseOrderItemId, receivedQuantity: l.quantity, acquisitionUnitCostXaf: l.unitCostXaf };
    }) }, context);
  if (receipt.items.length !== p.lines.length || receipt.items.reduce((n: number, l: any) => n + l.quantity,0) !== p.lines.reduce((n: number,l: any) => n + l.quantity,0)) refuse("RECEIPT_RECONCILIATION");
  return { purchaseOrderId: po.purchaseOrderId, receiptId: receipt.receiptId, lineCount: receipt.items.length, quantity: receipt.items.reduce((n: number,l: any)=>n+l.quantity,0) };
}

export async function takeSnapshot(reader: any) {
  const tables = ["skus","cigar_catalog","products","bundles","bundle_items","accessories","pack_size_config","stock_suppliers","stock_locations","stock_purchase_orders","stock_purchase_order_items","stock_receipts","stock_receipt_items","stock_provenance_lots","stock_balances","stock_location_balances","stock_lot_location_balances","stock_movements","stock_movement_groups","stock_movement_lot_allocations","stock_lot_cost_basis","orders","order_items","cash_journal_entries","customers","order_item_components","stock_consignments","consignment_cash_entries"];
  const snapshot: Record<string,string> = {};
  for (const table of tables) {
    const optional=["stock_consignments","consignment_cash_entries"].includes(table);
    const exists=!optional||rows(await reader.execute(sql`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table}`)).length>0;
    const records = exists?rows(await reader.execute(sql.raw(`SELECT * FROM ${table}`))):[];
    snapshot[table] = hash(records.map(r => JSON.stringify(r)).sort());
  }
  return { tables: snapshot, digest: hash(snapshot) };
}

export async function reconcile(reader: any, plan: V6Plan) {
  const journal = rows(await reader.execute(sql`SELECT source_record_id,source_hash,target_json FROM v6_import_journal WHERE source_system='MASTER_GESTION' ORDER BY source_record_id`));
  for (const item of journal) {
    const op = plan.operations.find(x => x.source_record_id === item.source_record_id);
    if (!op || hash(op) !== item.source_hash) refuse("JOURNAL_RECONCILIATION");
    if(op.kind==="commercial"){
      const p=op.payload,target=typeof item.target_json==="string"?JSON.parse(item.target_json):item.target_json;
      if(p.classification==="CONSIGNMENT"){
        const actual=rows(await reader.execute(sql`SELECT commercial_value_xaf FROM stock_consignments WHERE consignment_id=${p.orderId}`));
        const cash=rows(await reader.execute(sql`SELECT COALESCE(SUM(amount_xaf),0) AS amount FROM consignment_cash_entries WHERE consignment_id=${p.orderId}`));
        if(actual.length!==1||Number(actual[0].commercial_value_xaf)!==p.netXaf||Number(cash[0].amount)!==p.paidXaf)refuse("CONSIGNMENT_RECONCILIATION");
      }else{
        const actual=rows(await reader.execute(sql`SELECT final_sale_total_xaf,amount_paid,balance_due FROM orders WHERE order_id=${p.orderId}`));
        const cash=rows(await reader.execute(sql`SELECT COALESCE(SUM(CASE WHEN entry_type='RECEIPT' THEN amount_xaf ELSE -amount_xaf END),0) AS amount FROM cash_journal_entries WHERE order_id=${p.orderId}`));
        const lines=rows(await reader.execute(sql`SELECT COUNT(*) AS n,SUM(actual_line_revenue_xaf) AS net FROM order_items WHERE order_id=${p.orderId}`));
        if(actual.length!==1||Number(actual[0].final_sale_total_xaf)!==p.netXaf||Number(actual[0].amount_paid)!==p.paidXaf||Number(actual[0].balance_due)!==p.balanceXaf||Number(cash[0].amount)!==p.paidXaf||Number(lines[0].n)!==p.lines.length||Number(lines[0].net)!==p.netXaf)refuse("SALE_RECONCILIATION");
      }
      for(const l of target.lines)for(const c of l.components)if(c.groupId){
        const quantity=rows(await reader.execute(sql`SELECT -SUM(qty_delta) AS n FROM stock_movements WHERE group_id=${c.groupId} AND balance_field='onHand' AND sku=${c.sku}`));
        if(Number(quantity[0].n)!==c.quantity)refuse("SALE_STOCK_RECONCILIATION");
      }
    }
    if (op.kind === "purchase") {
      const target = typeof item.target_json === "string" ? JSON.parse(item.target_json) : item.target_json;
      const actual = rows(await reader.execute(sql`SELECT sku,type,pack_size,quantity FROM stock_receipt_items WHERE receipt_id=${target.receiptId} ORDER BY sku,type,pack_size`));
      const desired = op.payload.lines.map((x:any)=>({sku:x.sku,type:x.type,pack_size:x.packSize,quantity:x.quantity}));
      if (hash(actual.map(x=>JSON.stringify(x)).sort()) !== hash(desired.map((x:any)=>JSON.stringify(x)).sort())) refuse("PURCHASE_RECONCILIATION");
      const costs=rows(await reader.execute(sql`SELECT i.sku,i.type,i.pack_size,c.unit_cost_xaf FROM stock_receipt_items i LEFT JOIN stock_lot_cost_basis c ON c.lot_id=i.lot_id AND c.sku=i.sku AND c.type=i.type AND c.pack_size=i.pack_size WHERE i.receipt_id=${target.receiptId}`));
      for(const line of op.payload.lines){const c=costs.find(x=>x.sku===line.sku&&x.type===line.type&&Number(x.pack_size)===line.packSize);if(!c||c.unit_cost_xaf===null||Math.abs(Number(c.unit_cost_xaf)-line.unitCostXaf)>0.00001)refuse("PURCHASE_COST_RECONCILIATION");}
      const supplier=rows(await reader.execute(sql`SELECT s.code FROM stock_receipts r JOIN stock_suppliers s ON s.supplier_id=r.supplier_id WHERE r.receipt_id=${target.receiptId}`));
      if(supplier[0]?.code!==op.payload.supplierCode)refuse("PURCHASE_SUPPLIER_RECONCILIATION");
    }
  }
  // All three stock projections must agree, across pre-existing fixtures and V6.
  const a=rows(await reader.execute(sql`SELECT sku,type,pack_size,on_hand_qty,reserved_client_qty,reserved_event_qty,at_event_qty,deposit_qty,transit_qty FROM stock_balances ORDER BY sku,type,pack_size`));
  for (const table of ["stock_location_balances","stock_lot_location_balances"]) {
    const b=rows(await reader.execute(sql.raw(`SELECT sku,type,pack_size,SUM(on_hand_qty) AS on_hand_qty,SUM(reserved_client_qty) AS reserved_client_qty,SUM(reserved_event_qty) AS reserved_event_qty,SUM(at_event_qty) AS at_event_qty,SUM(deposit_qty) AS deposit_qty,SUM(transit_qty) AS transit_qty FROM ${table} GROUP BY sku,type,pack_size ORDER BY sku,type,pack_size`)));
    const normalized=(list:any[])=>list.map(x=>[x.sku,x.type,Number(x.pack_size),Number(x.on_hand_qty),Number(x.reserved_client_qty),Number(x.reserved_event_qty),Number(x.at_event_qty),Number(x.deposit_qty),Number(x.transit_qty)]);
    if(hash(normalized(a))!==hash(normalized(b)))refuse("STOCK_PROJECTION_RECONCILIATION");
  }
  if(journal.length===plan.operations.length && plan.expected.opening_balances && !plan.expected.final_balances){
    const actual=rows(await reader.execute(sql`SELECT sku,type,pack_size,on_hand_qty,deposit_qty FROM stock_balances WHERE sku LIKE 'CTCG-%' ORDER BY sku,type,pack_size`));
    const desired=plan.expected.opening_balances;
    const normalize=(list:any[])=>list.map(x=>[x.sku,x.type,Number(x.packSize??x.pack_size),Number(x.onHand??x.on_hand_qty),Number(x.deposit??x.deposit_qty)]).filter(x=>x[3]!==0||x[4]!==0).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if(hash(normalize(actual))!==hash(normalize(desired)))refuse("OPENING_STOCK_RECONCILIATION");
  }
  let finalControls:any=null;
  if(journal.length===plan.operations.length&&plan.expected.final_balances){
    const actual=rows(await reader.execute(sql`SELECT sku,type,pack_size,on_hand_qty,deposit_qty FROM stock_balances WHERE sku LIKE 'CTCG-%' ORDER BY sku,type,pack_size`));
    const normalize=(list:any[])=>list.map(x=>[x.sku,x.type,Number(x.packSize??x.pack_size),Number(x.onHand??x.on_hand_qty),Number(x.deposit??x.deposit_qty)]).filter(x=>x[3]!==0||x[4]!==0).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if(hash(normalize(actual))!==hash(normalize(plan.expected.final_balances)))refuse("FINAL_STOCK_RECONCILIATION");
    const [sales]=rows(await reader.execute(sql`SELECT COUNT(*) AS n,COALESCE(SUM(final_sale_total_xaf),0) AS revenue,COALESCE(SUM(amount_paid),0) AS paid,COALESCE(SUM(balance_due),0) AS balance FROM orders WHERE source_system='MASTER_GESTION_V6'`));
    const [dep]=rows(await reader.execute(sql`SELECT COUNT(*) AS n,COALESCE(SUM(commercial_value_xaf),0) AS value FROM stock_consignments`));
    const [advance]=rows(await reader.execute(sql`SELECT COALESCE(SUM(amount_xaf),0) AS value FROM consignment_cash_entries`));
    const e=plan.expected;
    if(Number(sales.n)!==e.salesCount||Number(sales.revenue)!==e.revenueXaf||Number(sales.paid)!==e.salesCashXaf||Number(sales.balance)!==e.receivablesXaf||Number(dep.n)!==e.consignmentCount||Number(dep.value)!==e.consignmentValueXaf||Number(advance.value)!==e.advanceXaf||Number(dep.value)-Number(advance.value)!==e.consignmentBalanceXaf)refuse("FINAL_FINANCE_RECONCILIATION");
    finalControls={stock_identities:e.final_balances.length,held:actual.reduce((n,x)=>n+Number(x.on_hand_qty),0),deposit:actual.reduce((n,x)=>n+Number(x.deposit_qty),0),sales_count:Number(sales.n),sales_net_xaf:Number(sales.revenue),sales_cash_xaf:Number(sales.paid),sales_receivable_xaf:Number(sales.balance),consignment_count:Number(dep.n),consignment_value_xaf:Number(dep.value),advance_xaf:Number(advance.value)};
  }
  return { operations: journal.length, expected: plan.operations.length, complete: journal.length===plan.operations.length,finalControls };
}

export async function runV6Import() {
  let lock: any;
  const audit = (event: string, detail: any = {}) => console.log(JSON.stringify({ job: "v6-import-v1", event, at: new Date().toISOString(), ...detail }));
  try {
    const config = validateJobEnvironment(process.env,Date.now());
    if (!config) return;
    lock = await mysqlPool.getConnection();
    const [identity]: any = await lock.query("SELECT DATABASE() AS name");
    if(identity[0]?.name!==V6_DATABASE)refuse("LIVE_DATABASE_GUARD");
    const [got]: any = await lock.query("SELECT GET_LOCK('V6_STAGING_IMPORT',0) AS acquired");
    if(Number(got[0]?.acquired)!==1)refuse("JOB_ALREADY_RUNNING");
    audit("IDENTITY_PASS",{database:V6_DATABASE,commit:process.env.RENDER_GIT_COMMIT,mode:config.mode,plan_sha256:process.env.V6_WRITE_PLAN_SHA256});
    const before=await takeSnapshot(db);
    const triggers=rows(await db.execute(sql`SELECT TRIGGER_NAME,ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=${V6_DATABASE} ORDER BY TRIGGER_NAME`));
    for(const name of ["trg_stock_movements_bu","trg_stock_movements_bd","trg_stock_movement_groups_bu","trg_stock_movement_groups_bd","trg_cash_journal_entries_bu","trg_cash_journal_entries_bd","trg_stock_lot_cost_basis_bu","trg_stock_lot_cost_basis_bd"]){
      if(!triggers.some(t=>t.TRIGGER_NAME===name&&/SIGNAL\s+SQLSTATE/i.test(t.ACTION_STATEMENT)))refuse("LEDGER_PROTECTION_MISSING");
    }
    const schema=rows(await db.execute(sql`SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=${V6_DATABASE} ORDER BY TABLE_NAME,ORDINAL_POSITION`));
    const schemaHash=hash({schema,triggers});
    const columns=rows(await db.execute(sql`SELECT TABLE_NAME,COLUMN_NAME,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=${V6_DATABASE} AND ((TABLE_NAME='stock_purchase_orders' AND COLUMN_NAME='ordered_at') OR (TABLE_NAME='stock_receipts' AND COLUMN_NAME='received_at') OR (TABLE_NAME IN ('stock_movements','stock_movement_groups') AND COLUMN_NAME='movement_date')) ORDER BY TABLE_NAME`));
    const journalExists=rows(await db.execute(sql`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=${V6_DATABASE} AND TABLE_NAME='v6_import_journal'`)).length>0;
    const historicalCostReady = schema.some(c=>c.TABLE_NAME==="stock_lot_cost_basis"&&c.COLUMN_NAME==="source"&&c.COLUMN_TYPE.includes("HISTORICAL_DERIVATION"));
    const commercialSchemaReady=["stock_consignments","consignment_cash_entries"].every(t=>schema.some(c=>c.TABLE_NAME===t)) && schema.some(c=>c.TABLE_NAME==="orders"&&c.COLUMN_NAME==="payment_date"&&c.IS_NULLABLE==="YES") && schema.some(c=>c.TABLE_NAME==="stock_movements"&&c.COLUMN_NAME==="movement_type"&&c.COLUMN_TYPE.includes("RECLASSEMENT_HISTORIQUE"));
    const migrationNeeded=!commercialSchemaReady||!historicalCostReady||columns.length!==4||columns.some(c=>c.IS_NULLABLE!=="YES")||!journalExists;
    if(config.mode==="dry-run") {
      const conflicts:string[]=[];
      if(journalExists)for(const op of config.plan.operations){const previous=rows(await db.execute(sql`SELECT source_hash FROM v6_import_journal WHERE source_system='MASTER_GESTION' AND source_record_id=${op.source_record_id}`));if(previous.length&&previous[0].source_hash!==hash(op))conflicts.push(hash(op.source_record_id));}
      let shadowOperations=0;
      if(!migrationNeeded && !conflicts.length){
        const rollback=Symbol("V6_DRY_RUN_ROLLBACK");
        try{await db.transaction(async(tx:any)=>{
          for(const op of config.plan.operations){
            if(Date.now()>=config.expires)refuse("EXPIRED");
            await journalOperation(tx,op,t=>executeOperation(t,op));shadowOperations++;
          }
          await reconcile(tx,config.plan);
          throw rollback;
        });}catch(e){if(e!==rollback)throw e;}
        if((await takeSnapshot(db)).digest!==before.digest)refuse("DRY_RUN_MUTATED_DATA");
      }
      audit("DRY_RUN",{shadow_operations:shadowOperations,shadow_rolled_back:shadowOperations>0,baseline_sha256:before.digest,schema_sha256:schemaHash,plan_sha256:process.env.V6_WRITE_PLAN_SHA256,migration_needed:migrationNeeded,conflicts,operation_count:config.plan.operations.length,blocked_phases:config.plan.blocked_phases,mutation_count:0});
      return;
    }
    if(config.mode==="migrate"||config.mode==="apply")if(before.digest!==process.env.V6_WRITE_EXPECTED_BASELINE)refuse("BASELINE_CHANGED");
    if(config.mode==="migrate"||config.mode==="apply")if(schemaHash!==process.env.V6_WRITE_EXPECTED_SCHEMA)refuse("SCHEMA_CHANGED");
    if(config.mode==="migrate") {
      for(const [table,column] of [["stock_purchase_orders","ordered_at"],["stock_receipts","received_at"],["stock_movements","movement_date"],["stock_movement_groups","movement_date"]]) {
        if(Date.now()>=config.expires)refuse("EXPIRED");
        await lock.query(`ALTER TABLE ${table} MODIFY ${column} TIMESTAMP NULL DEFAULT NULL`);
      }
      await lock.query("ALTER TABLE stock_lot_cost_basis MODIFY source ENUM('RECEIPT','BUNDLE_DERIVATION','HISTORICAL_DERIVATION') NOT NULL");
      await lock.query("ALTER TABLE orders MODIFY payment_date TIMESTAMP NULL DEFAULT NULL, MODIFY order_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
      for(const table of ["stock_movements","stock_movement_groups"])await lock.query(`ALTER TABLE ${table} MODIFY movement_type ENUM(${MOVEMENT_TYPES.map(t=>`'${t}'`).join(",")}) NOT NULL`);
      await lock.query(`CREATE TABLE IF NOT EXISTS stock_consignments (
        consignment_id VARCHAR(36) NOT NULL PRIMARY KEY,
        customer_id VARCHAR(36) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
        location_id VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
        occurred_at TIMESTAMP NOT NULL, commercial_value_xaf INT NOT NULL,
        source_record_id VARCHAR(190) NOT NULL UNIQUE, payload JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_v6_consignment_customer FOREIGN KEY(customer_id) REFERENCES customers(customer_id),
        CONSTRAINT fk_v6_consignment_location FOREIGN KEY(location_id) REFERENCES stock_locations(location_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await lock.query(`CREATE TABLE IF NOT EXISTS consignment_cash_entries (
        cash_entry_id VARCHAR(36) NOT NULL PRIMARY KEY, consignment_id VARCHAR(36) NOT NULL,
        amount_xaf INT NOT NULL, occurred_at TIMESTAMP NOT NULL,
        reference VARCHAR(190) NOT NULL UNIQUE, note TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_v6_consignment_cash FOREIGN KEY(consignment_id) REFERENCES stock_consignments(consignment_id),
        CONSTRAINT ck_v6_consignment_cash_positive CHECK(amount_xaf>0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      for(const table of ["stock_consignments","consignment_cash_entries"]){
        for(const [suffix,event] of [["bu","UPDATE"],["bd","DELETE"]]){
          const name=`trg_${table}_${suffix}`;
          const [found]:any=await lock.query("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=? AND TRIGGER_NAME=?",[V6_DATABASE,name]);
          if(!found.length)await lock.query(`CREATE TRIGGER ${name} BEFORE ${event} ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='consignment_ledger_immutable'`);
        }
      }
      await lock.query(JOURNAL_DDL);
      for(const [suffix,event] of [["bu","UPDATE"],["bd","DELETE"]]){
        const [found]:any=await lock.query("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=? AND TRIGGER_NAME=?",[V6_DATABASE,`trg_v6_import_journal_${suffix}`]);
        if(!found.length)await lock.query(`CREATE TRIGGER trg_v6_import_journal_${suffix} BEFORE ${event} ON v6_import_journal FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='v6_import_journal_immutable'`);
      }
      const after=await takeSnapshot(db);
      if(after.digest!==before.digest)refuse("MIGRATION_CHANGED_DATA");
      audit("MIGRATION_COMPLETE",{baseline_sha256:after.digest,business_data_unchanged:true});
      return;
    }
    if(migrationNeeded)refuse("MIGRATION_REQUIRED");
    for(const name of ["trg_v6_import_journal_bu","trg_v6_import_journal_bd"])if(!triggers.some(t=>t.TRIGGER_NAME===name&&/SIGNAL\s+SQLSTATE/i.test(t.ACTION_STATEMENT)))refuse("JOURNAL_PROTECTION_MISSING");
    for(const table of ["stock_consignments","consignment_cash_entries"])for(const suffix of ["bu","bd"])if(!triggers.some(t=>t.TRIGGER_NAME===`trg_${table}_${suffix}`&&/SIGNAL\s+SQLSTATE/i.test(t.ACTION_STATEMENT)))refuse("CONSIGNMENT_PROTECTION_MISSING");
    if(config.mode==="qualify"){
      const result=await reconcile(db,config.plan);if(!result.complete)refuse("QUALIFICATION_INCOMPLETE");
      const views=await qualifyStagingViews(config.plan);
      if((await takeSnapshot(db)).digest!==before.digest)refuse("QUALIFICATION_MUTATED_DATA");
      audit("QUALIFICATION_PASS",{...result,views,baseline_sha256:before.digest});return;
    }
    if(config.mode==="reconcile"){audit("RECONCILIATION",await reconcile(db,config.plan));return;}
    let applied=0,skipped=0;
    for(const op of config.plan.operations){
      if(Date.now()>=config.expires)refuse("EXPIRED");
      if(applied>=config.max)break;
      const [lockState]:any=await lock.query("SELECT IS_USED_LOCK('V6_STAGING_IMPORT')=CONNECTION_ID() AS held");
      if(Number(lockState[0]?.held)!==1)refuse("LOCK_LOST");
      const result=await journalOperation(db,op,tx=>executeOperation(tx,op));
      if(result.replay)skipped++;else applied++;
      audit(result.replay?"SKIP":"COMMIT",{record_key_sha256:hash(op.source_record_id),payload_sha256:hash(op),phase:op.phase});
      audit("RECONCILIATION",await reconcile(db,config.plan));
    }
    const after=await takeSnapshot(db);
    if(applied===0&&before.digest!==after.digest)refuse("REPLAY_MUTATED_DATA");
    audit("COMPLETE",{applied,skipped,baseline_sha256:after.digest,reconciliation:await reconcile(db,config.plan),blocked_phases:config.plan.blocked_phases});
  }catch(error:any){audit("FAILED_CLOSED",{code:error?.safeCode||(error?.code||error?.cause?.code)&&/^ER_[A-Z_0-9]+$/.test(error?.code||error?.cause?.code)&&(error?.code||error?.cause?.code)||"RUNTIME_FAILURE"});}
  finally{if(lock){try{await lock.query("SELECT RELEASE_LOCK('V6_STAGING_IMPORT')");}catch{}lock.release();}}
}

export function validateTransform(p: any) {
  if (p.eventDate !== null || !Array.isArray(p.inputs) || !p.inputs.length || !Array.isArray(p.outputs) || !p.outputs.length || !p.reason) refuse("TRANSFORM_SHAPE");
  const remaining = new Map<string, number>();
  for (const i of p.inputs) {
    if (remaining.has(i.sku) || i.type !== "Box" || i.packSize !== 0 || !Number.isInteger(i.quantity) || i.quantity <= 0 || !Number.isInteger(i.cigarsPerUnit) || i.cigarsPerUnit <= 0 || !Number.isInteger(i.legacyDeltaCigars)) refuse("TRANSFORM_INPUT");
    remaining.set(i.sku, i.quantity * i.cigarsPerUnit + i.legacyDeltaCigars);
  }
  const outputKeys = new Set();
  for (const o of p.outputs) {
    if (outputKeys.has(o.sku) || o.type !== "Pack" || !Number.isInteger(o.quantity) || o.quantity <= 0 || !Number.isInteger(o.packSize) || o.packSize <= 0 || !Array.isArray(o.recipe) || o.recipe.reduce((n:number,c:any)=>n+c.quantity,0)!==o.packSize) refuse("TRANSFORM_OUTPUT");
    outputKeys.add(o.sku);
    for (const c of o.recipe) {
      if (!remaining.has(c.sku) || !Number.isInteger(c.quantity) || c.quantity <= 0) refuse("TRANSFORM_RECIPE");
      remaining.set(c.sku, remaining.get(c.sku)! - c.quantity * o.quantity);
    }
  }
  if (Array.from(remaining.values()).some(n=>n!==0)) refuse("TRANSFORM_CONSERVATION");
}

export async function importTransform(tx: any, op: V6Operation) {
  const p=op.payload; validateTransform(p);
  const locationId=stableId("location:unknown"), inputCosts=new Map<string,number>(), sourceLots:any[]=[], groups:string[]=[];
  const meta={author:"V6_IMPORT",referenceType:"OTHER" as const,referenceId:stableId(op.source_record_id),referenceLabel:op.source_record_id,movementDate:null,comment:p.reason};
  for(const i of [...p.inputs].sort((a:any,b:any)=>a.sku.localeCompare(b.sku))){
    const product=rows(await tx.execute(sql`SELECT cigars_per_box FROM products WHERE sku=${i.sku}`));
    if(product[0]?.cigars_per_box!==i.cigarsPerUnit)refuse("TRANSFORM_SOURCE_UNIT");
    const result=await stockStorage.applyLocationMovement({...meta,sku:i.sku,type:"Box",packSize:0,qty:i.quantity,movementType:"OUVERTURE_BOITE",sourceLocationId:locationId},tx);
    groups.push(result.groupId);
    const allocations=rows(await tx.execute(sql`SELECT a.lot_id,a.qty_delta,c.unit_cost_xaf FROM stock_movement_lot_allocations a LEFT JOIN stock_lot_cost_basis c ON c.lot_id=a.lot_id AND c.sku=a.sku AND c.type=a.type AND c.pack_size=a.pack_size WHERE a.group_id=${result.groupId} AND a.qty_delta<0`));
    if(!allocations.length || allocations.some(a=>a.unit_cost_xaf===null))refuse("TRANSFORM_COST_UNKNOWN");
    const cost=allocations.reduce((n,a)=>n+(-Number(a.qty_delta))*Number(a.unit_cost_xaf),0);
    inputCosts.set(i.sku,cost/(i.quantity*i.cigarsPerUnit));
    sourceLots.push({sku:i.sku,allocations,inputCostXaf:cost,legacyDeltaCigars:i.legacyDeltaCigars,legacyValuationDeltaXaf:i.legacyDeltaCigars*cost/(i.quantity*i.cigarsPerUnit)});
  }
  const outputLots:any[]=[];
  for(const o of [...p.outputs].sort((a:any,b:any)=>a.sku.localeCompare(b.sku))){
    const target=rows(await tx.execute(sql`SELECT kind FROM skus WHERE sku=${o.sku}`));
    if(target.length!==1 || !["CIGAR","BUNDLE"].includes(target[0].kind))refuse("TRANSFORM_TARGET_MISSING");
    const lotId=stableId(`${op.source_record_id}:${o.sku}`), cost=o.recipe.reduce((n:number,c:any)=>n+inputCosts.get(c.sku)!*c.quantity,0);
    await tx.insert(stockProvenanceLots).values({lotId,lotCode:`V6-T-${hash(o.sku).slice(0,20)}`,originKind:"OTHER",sourceReference:op.source_record_id,notes:JSON.stringify({historicalTransformation:true,datePrecision:"UNKNOWN",recipe:o.recipe,inputLots:sourceLots.filter(i=>o.recipe.some((c:any)=>c.sku===i.sku))})});
    await tx.insert(stockLotCostBasis).values({lotId,sku:o.sku,type:"Pack",packSize:o.packSize,unitCostXaf:cost.toFixed(4),source:"HISTORICAL_DERIVATION",sourceReference:op.source_record_id});
    if(o.sku.startsWith("CTCG-BDL-")){
      for(const c of o.recipe){
        const cigar=rows(await tx.execute(sql`SELECT cigar_id FROM products WHERE sku=${c.sku}`));
        await tx.insert(bundleItems).values({bundleSku:o.sku,productSku:c.sku,componentCigarId:cigar[0]?.cigar_id??null,quantite:c.quantity});
      }
    }
    const result=await stockStorage.applyLocationMovement({...meta,sku:o.sku,type:"Pack",packSize:o.packSize,qty:o.quantity,movementType:o.sku.startsWith("CTCG-BDL-")?"ASSEMBLAGE_COMPOSITE":"OUVERTURE_BOITE",destinationLocationId:locationId,lotId},tx);
    groups.push(result.groupId);outputLots.push({sku:o.sku,lotId,quantity:o.quantity,unitCostXaf:cost.toFixed(4)});
  }
  return {groups,inputLots:sourceLots,outputLots,legacyValuationDeltaXaf:sourceLots.reduce((n,i)=>n+i.legacyValuationDeltaXaf,0)};
}

export async function importOpening(tx:any,op:V6Operation){
  const p=op.payload,locationId=stableId("location:unknown"),lotId=stableId(op.source_record_id);
  await tx.insert(stockProvenanceLots).values({lotId,lotCode:`V6-L-${hash(op.source_record_id).slice(0,20)}`,originKind:"LEGACY_UNKNOWN",sourceReference:op.source_record_id,notes:p.reason});
  if(p.unitCostXaf===0)await tx.insert(stockLotCostBasis).values({lotId,sku:p.sku,type:p.type,packSize:p.packSize,unitCostXaf:"0.0000",source:"HISTORICAL_DERIVATION",sourceReference:op.source_record_id});
  const balance=rows(await tx.execute(sql`SELECT on_hand_qty FROM stock_location_balances WHERE location_id=${locationId} AND sku=${p.sku} AND type=${p.type} AND pack_size=${p.packSize} FOR UPDATE`));
  const result=await stockStorage.applyLocationMovement({author:"V6_IMPORT",referenceType:"OTHER",referenceId:lotId,referenceLabel:op.source_record_id,movementDate:null,comment:p.reason,sku:p.sku,type:p.type,packSize:p.packSize,qty:Number(balance[0]?.on_hand_qty||0)+p.quantity,movementType:"CORRECTION_INVENTAIRE",sourceLocationId:locationId,lotId},tx);
  return {lotId,groupId:result.groupId,quantity:p.quantity,costKnown:p.unitCostXaf!==null};
}

export async function executeOperation(tx:any,op:V6Operation){
  switch(op.kind){
    case "catalog": return importCatalog(tx,op);
    case "purchase": return importPurchase(tx,op);
    case "transform": return importTransform(tx,op);
    case "opening": return importOpening(tx,op);
    case "commercial": return importCommercial(tx,op);
    case "adjustment": case "reclass": return importClosingAdjustment(tx,op);
    default: refuse("UNIMPLEMENTED_OPERATION");
  }
}
