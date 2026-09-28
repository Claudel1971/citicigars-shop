import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../db.mysql";
import { JOURNAL_DDL, journalOperation, stableId, importCatalog, importPurchase, validateJobEnvironment, validatePlan, type V6Operation } from "./v6-import";
import { historicalPurchaseDate } from "../services/purchasing";

const database = "citicigars_ci";
const cat: V6Operation = { source_record_id:"MG:CATALOG:CI",phase:"PS1",kind:"catalog",payload:{cigars:[],suppliers:[{code:"V6_CI","name":"CI supplier"}],skus:[{sku:"CTCG-CI-V6",kind:"CIGAR",packSizes:[],product:{sku:"CTCG-CI-V6",marque:"CI",cigarsPerBox:20}}]} };
const buy: V6Operation = { source_record_id:"MG:PURCHASE_ORDER:CI",phase:"PS2",kind:"purchase",payload:{supplierCode:"V6_CI",orderedAt:null,receivedAt:null,period:"2025-11",reference:"CI-V6",costingMethod:"fixture",lines:[{sku:"CTCG-CI-V6",type:"Box",packSize:0,quantity:2,unitCostXaf:123.4567}]} };

describe("V6 transaction/replay on isolated CI MySQL",()=>{
  beforeAll(async()=>{
    const result:any=await db.execute(sql`SELECT DATABASE() AS name`);
    if(result[0][0].name!==database)throw new Error("CI database required");
    await db.execute(sql.raw(JOURNAL_DDL));
  });
  it("rolls back business writes and leaves no completed journal on failure",async()=>{
    const op={...cat,source_record_id:"MG:CATALOG:FAIL"};
    await expect(journalOperation(db,op,async tx=>{
      await tx.execute(sql`INSERT INTO skus (sku,kind) VALUES ('CTCG-CI-ROLLBACK','CIGAR')`);
      throw new Error("simulated receipt failure");
    },database)).rejects.toThrow("simulated receipt failure");
    const result:any=await db.execute(sql`SELECT sku FROM skus WHERE sku='CTCG-CI-ROLLBACK'`);
    expect(result[0]).toHaveLength(0);
    const journal:any=await db.execute(sql`SELECT source_record_id FROM v6_import_journal WHERE source_record_id='MG:CATALOG:FAIL'`);
    expect(journal[0]).toHaveLength(0);
  });
  it("commits PO, receipt, stock and source record atomically; resumes without duplicates",async()=>{
    await journalOperation(db,cat,tx=>importCatalog(tx,cat),database);
    const first:any=await journalOperation(db,buy,tx=>importPurchase(tx,buy),database);
    expect(first.replay).toBe(false);
    const receipt:any=await db.execute(sql`SELECT received_at FROM stock_receipts WHERE receipt_id=${first.target.receiptId}`);
    expect(receipt[0][0].received_at).toBeNull();
    const po:any=await db.execute(sql`SELECT ordered_at FROM stock_purchase_orders WHERE purchase_order_id=${first.target.purchaseOrderId}`);
    expect(po[0][0].ordered_at).toBeNull();
    const second:any=await journalOperation(db,buy,()=>{throw new Error("adapter must not run on replay");},database);
    expect(second.replay).toBe(true);
    expect(second.target.receiptId).toBe(first.target.receiptId);
    const balance:any=await db.execute(sql`SELECT on_hand_qty FROM stock_balances WHERE sku='CTCG-CI-V6' AND type='Box'`);
    expect(balance[0][0].on_hand_qty).toBe(2);
    const entries:any=await db.execute(sql`SELECT COUNT(*) AS n FROM stock_receipt_items WHERE receipt_id=${first.target.receiptId}`);
    expect(Number(entries[0][0].n)).toBe(1);
  });
  it("rejects reuse of source ID with changed content before adapter runs",async()=>{
    const changed={...buy,payload:{...buy.payload,reference:"changed"}};
    await expect(journalOperation(db,changed,()=>{throw new Error("unsafe adapter called");},database)).rejects.toThrow("SOURCE_HASH_CONFLICT");
  });
  it("a failed downstream receipt rolls back its purchase order as well",async()=>{
    const bad={...buy,source_record_id:"MG:PURCHASE_ORDER:FAIL_RECEIPT",payload:{...buy.payload,lines:[{...buy.payload.lines[0],unitCostXaf:-1}]}};
    await expect(journalOperation(db,bad,tx=>importPurchase(tx,bad),database)).rejects.toThrow();
    const po:any=await db.execute(sql`SELECT purchase_order_id FROM stock_purchase_orders WHERE client_request_id=${stableId(`${bad.source_record_id}:po`)}`);
    expect(po[0]).toHaveLength(0);
  });
});

describe("V6 guards and partial date provenance",()=>{
 it("preserves a month without manufacturing a day",()=>{
   expect(historicalPurchaseDate("","2025-11")).toBeNull();
   expect(()=>historicalPurchaseDate("2025-11-01","2025-11")).toThrow();
   expect(()=>historicalPurchaseDate("","2025-13")).toThrow();
 });
 it("uses deterministic valid request UUIDs",()=>{
   expect(stableId("source")).toBe(stableId("source"));
   expect(stableId("source")).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
 });
 it("disabled means no execution and enabled wrong target fails",()=>{
   expect(validateJobEnvironment({},Date.now())).toBeNull();
   expect(()=>validateJobEnvironment({V6_WRITE_ENABLED:"true",RENDER:"true",RENDER_SERVICE_ID:"production"},Date.now())).toThrow("SERVICE_GUARD");
 });
 it("rejects duplicate source identities and unsupported phases",()=>{
   const plan:any={version:1,source_sha256:"48d8ea8523728b00cd0a2949c61302148309656a75ede590c32c709c1b77174a",operations:[buy,buy]};
   expect(()=>validatePlan(plan)).toThrow("SOURCE_ID");
   expect(()=>validatePlan({...plan,operations:[{...buy,phase:"PS4"}]})).toThrow("PURCHASE_PLAN");
 });
});
