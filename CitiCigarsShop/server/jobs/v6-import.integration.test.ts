import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../db.mysql";
import { JOURNAL_DDL, journalOperation, stableId, importCatalog, importPurchase, validateJobEnvironment, validatePlan, type V6Operation, importTransform, validateTransform } from "./v6-import";
import { historicalPurchaseDate } from "../services/purchasing";

const database = "citicigars_ci";
const cat: V6Operation = { source_record_id:"MG:CATALOG:CI",phase:"PS1",kind:"catalog",payload:{cigars:[],suppliers:[{code:"V6_CI","name":"CI supplier"}],skus:[{sku:"CTCG-CI-V6",kind:"CIGAR",packSizes:[10],product:{sku:"CTCG-CI-V6",marque:"CI",cigarsPerBox:20}}]} };
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
  it("rolls back an entire multi-leg opening when an output cannot be created",async()=>{
    const op:V6Operation={source_record_id:"MG:TRANSFORM:FAIL",phase:"PS3",kind:"transform",payload:{eventDate:null,reason:"CI",inputs:[{sku:"CTCG-CI-V6",type:"Box",packSize:0,quantity:1,cigarsPerUnit:20,legacyDeltaCigars:0}],outputs:[{sku:"CTCG-CI-MISSING",type:"Pack",packSize:10,quantity:2,recipe:[{sku:"CTCG-CI-V6",quantity:10}]}]}};
    await expect(journalOperation(db,op,tx=>importTransform(tx,op),database)).rejects.toThrow();
    const result:any=await db.execute(sql`SELECT on_hand_qty FROM stock_balances WHERE sku='CTCG-CI-V6' AND type='Box'`);
    expect(result[0][0].on_hand_qty).toBe(2);
  });
  it("opens directly into packs with source lot lineage and derived cost, without transient loose stock",async()=>{
    const op:V6Operation={source_record_id:"MG:TRANSFORM:CI",phase:"PS3",kind:"transform",payload:{eventDate:null,reason:"CI",inputs:[{sku:"CTCG-CI-V6",type:"Box",packSize:0,quantity:1,cigarsPerUnit:20,legacyDeltaCigars:0}],outputs:[{sku:"CTCG-CI-V6",type:"Pack",packSize:10,quantity:2,recipe:[{sku:"CTCG-CI-V6",quantity:10}]}]}};
    const result:any=await journalOperation(db,op,tx=>importTransform(tx,op),database);
    expect(result.target.inputLots[0].allocations).toHaveLength(1);
    const balances:any=await db.execute(sql`SELECT type,on_hand_qty FROM stock_balances WHERE sku='CTCG-CI-V6' ORDER BY type`);
    expect(balances[0]).toEqual([{type:"Box",on_hand_qty:1},{type:"Pack",on_hand_qty:2}]);
    expect(Number(result.target.outputLots[0].unitCostXaf)).toBeCloseTo(61.72835,3);
    expect((await journalOperation(db,op,()=>{throw new Error("replay called");},database)).replay).toBe(true);
  });
});

describe("V6 guards and partial date provenance",()=>{
 it("rejects unexplained cigar creation before transformation",()=>{
   expect(()=>validateTransform({eventDate:null,reason:"test",inputs:[{sku:"A",type:"Box",packSize:0,quantity:1,cigarsPerUnit:20,legacyDeltaCigars:0}],outputs:[{sku:"B",type:"Pack",packSize:5,quantity:5,recipe:[{sku:"A",quantity:5}]}]})).toThrow("TRANSFORM_CONSERVATION");
 });
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

import { importCommercial, importClosingAdjustment, validateCommercial } from "./v6-commercial";
const commercialFixture=(id:string,stockType="Box",classification="SALE"):V6Operation=>({source_record_id:`MG:ORDER:${id}`,phase:"PS4",kind:"commercial",payload:{orderId:id,date:"2026-01-02",classification,customer:{name:"V6 CI customer",phone:"+237699000999",city:"CI",internal:false},grossXaf:200,discountXaf:0,netXaf:200,paidXaf:100,balanceXaf:100,sourceCommercialRows:[1],sourceNotes:[],depositLocation:{code:"CI_DEPOT",name:"CI deposit",evidence:"test"},payments:[{source_record_id:`MG:CASH:${id}`,date:"2026-01-03",amountXaf:100}],lines:[{source_record_id:`MG:LINE:${id}`,itemSku:"CTCG-CI-V6",itemType:"PRODUCT",label:"CI line",quantity:1,grossXaf:200,discountXaf:0,netXaf:200,components:[{source_record_id:`MG:COMP:${id}`,sku:"CTCG-CI-V6",stockType,packSize:stockType==="Pack"?10:0,quantity:1,label:"CI cigar",sourceUnitCostXaf:123.4567,sourceLineCostXaf:123.4567}]}]}});

describe("V6 commercial and consignment isolation",()=>{
 it("stores a sale, stock consumption and dated cash atomically",async()=>{
   const op=commercialFixture("CTCG-SALE-990001");
   const result:any=await journalOperation(db,op,tx=>importCommercial(tx,op),database);
   expect(result.target.consignment).toBe(false);expect(result.target.costKnown).toBe(true);
   const records:any=await db.execute(sql`SELECT final_sale_total_xaf,amount_paid,balance_due,order_date FROM orders WHERE order_id='CTCG-SALE-990001'`);
   expect(records[0][0].amount_paid).toBe(100);expect(records[0][0].balance_due).toBe(100);
   expect(records[0][0].order_date.toISOString().slice(0,10)).toBe("2026-01-02");
   expect((await journalOperation(db,op,()=>{throw new Error("unexpected replay");},database)).replay).toBe(true);
 });
 it("keeps a consignment advance out of sales and preserves ownership",async()=>{
   const op=commercialFixture("CTCG-SALE-990002","Pack","CONSIGNMENT");
   await journalOperation(db,op,tx=>importCommercial(tx,op),database);
   const sale:any=await db.execute(sql`SELECT order_id FROM orders WHERE order_id='CTCG-SALE-990002'`);expect(sale[0]).toHaveLength(0);
   const cash:any=await db.execute(sql`SELECT amount_xaf FROM consignment_cash_entries WHERE consignment_id='CTCG-SALE-990002'`);expect(cash[0][0].amount_xaf).toBe(100);
   const balance:any=await db.execute(sql`SELECT on_hand_qty,deposit_qty FROM stock_balances WHERE sku='CTCG-CI-V6' AND type='Pack'`);expect(balance[0][0]).toEqual({on_hand_qty:1,deposit_qty:1});
 });
 it("reclassifies legacy detention without declaring a physical return",async()=>{
   const op:V6Operation={source_record_id:"MG:RECLASS:CI",phase:"PS5",kind:"reclass",payload:{sku:"CTCG-CI-V6",type:"Pack",packSize:10,quantity:1,depositLocationCode:"CI_DEPOT",reason:"CI legacy reconciliation",eventDate:null}};
   const result:any=await journalOperation(db,op,tx=>importClosingAdjustment(tx,op),database);
   const movements:any=await db.execute(sql`SELECT movement_type,movement_date FROM stock_movement_groups WHERE group_id=${result.target.groupId}`);
   expect(movements[0][0].movement_type).toBe("RECLASSEMENT_HISTORIQUE");expect(movements[0][0].movement_date).toBeNull();
   const balance:any=await db.execute(sql`SELECT on_hand_qty,deposit_qty FROM stock_balances WHERE sku='CTCG-CI-V6' AND type='Pack'`);expect(balance[0][0]).toEqual({on_hand_qty:2,deposit_qty:0});
 });
 it("rolls back sale and stock when its cash reference conflicts at the final step",async()=>{
   const op=commercialFixture("CTCG-SALE-990003","Pack");op.payload.payments[0].source_record_id="MG:CASH:CTCG-SALE-990001";
   await expect(journalOperation(db,op,tx=>importCommercial(tx,op),database)).rejects.toThrow();
   const sale:any=await db.execute(sql`SELECT order_id FROM orders WHERE order_id='CTCG-SALE-990003'`);expect(sale[0]).toHaveLength(0);
   const balance:any=await db.execute(sql`SELECT on_hand_qty FROM stock_balances WHERE sku='CTCG-CI-V6' AND type='Pack'`);expect(balance[0][0].on_hand_qty).toBe(2);
 });
 it("rejects inconsistent cash and commercial totals before writing",()=>{
   const op=commercialFixture("CTCG-SALE-990004");op.payload.paidXaf=99;
   expect(()=>validateCommercial(op.payload)).toThrow("COMMERCIAL_RECONCILIATION");
 });
});
