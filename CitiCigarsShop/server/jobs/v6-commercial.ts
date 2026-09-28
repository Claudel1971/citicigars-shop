import { sql } from "drizzle-orm";
import { stockStorage } from "../storage.stock";
import { stockLocations } from "../../shared/schema.stock";
import { customers } from "../../shared/schema.crm";
import { orders, orderItems, orderItemComponents, stockConsignments, consignmentCashEntries } from "../../shared/schema.sales";
import { appendCashEntry } from "../services/finance-close05";
import { hash, stableId, type V6Operation } from "./v6-import";
const rows=(r:any):any[]=>r[0];
function refuse(code:string):never{throw Object.assign(new Error(code),{safeCode:code});}
const date=(s:string)=>new Date(`${s}T00:00:00.000Z`);

export function validateCommercial(p:any){
  if(!/^CTCG-SALE-\d{6}$/.test(p.orderId)||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!["SALE","MARKET_PENETRATION","CONSIGNMENT"].includes(p.classification)||!p.customer?.name||!/^\+\d{8,15}$/.test(p.customer.phone)||!Array.isArray(p.lines)||!p.lines.length)refuse("COMMERCIAL_SHAPE");
  for(const key of ["grossXaf","discountXaf","netXaf","paidXaf","balanceXaf"])if(!Number.isSafeInteger(p[key])||p[key]<0)refuse("COMMERCIAL_AMOUNT");
  if(p.grossXaf-p.discountXaf!==p.netXaf||p.netXaf-p.paidXaf!==p.balanceXaf||p.lines.reduce((n:number,l:any)=>n+l.netXaf,0)!==p.netXaf||p.lines.reduce((n:number,l:any)=>n+l.grossXaf,0)!==p.grossXaf||p.payments.reduce((n:number,c:any)=>n+c.amountXaf,0)!==p.paidXaf)refuse("COMMERCIAL_RECONCILIATION");
  const ids=new Set();
  for(const l of p.lines){
    if(ids.has(l.source_record_id)||!Number.isSafeInteger(l.quantity)||l.quantity<=0||l.grossXaf-l.discountXaf!==l.netXaf||l.grossXaf%l.quantity||l.netXaf%l.quantity||!l.components?.length)refuse("COMMERCIAL_LINE");
    ids.add(l.source_record_id);
    for(const c of l.components){
      if(ids.has(c.source_record_id)||!Number.isSafeInteger(c.quantity)||c.quantity<=0||c.quantity%l.quantity||!/^CTCG-/.test(c.sku)|| (c.stockType===null?!c.sku.startsWith("CTCG-SRV-"):!["Box","Pack","Accessory"].includes(c.stockType)))refuse("COMPONENT_PLAN");
      ids.add(c.source_record_id);
    }
  }
  for(const c of p.payments)if(!Number.isSafeInteger(c.amountXaf)||c.amountXaf<=0||!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||date(c.date)<date(p.date))refuse("CASH_PLAN");
  if(p.classification==="MARKET_PENETRATION"&&p.netXaf!==0)refuse("FREE_SALE_PLAN");
  if(p.classification==="CONSIGNMENT"&&!p.depositLocation?.code)refuse("CONSIGNMENT_LOCATION");
}

async function customerFor(tx:any,p:any){
  const c=p.customer,id=stableId(`customer:${c.phone}:${c.name.trim().toLowerCase()}`);
  const existing=rows(await tx.execute(sql`SELECT customer_id,first_name,last_name,is_internal FROM customers WHERE phone_whatsapp=${c.phone} OR customer_id=${id} FOR UPDATE`));
  if(existing.length){
    if(existing.length!==1||`${existing[0].first_name??""} ${existing[0].last_name??""}`.trim().toLowerCase()!==c.name.trim().toLowerCase()||Boolean(existing[0].is_internal)!==Boolean(c.internal))refuse("CUSTOMER_IDENTITY_CONFLICT");
    return existing[0].customer_id;
  }
  await tx.insert(customers).values({customerId:id,firstName:c.name,phoneWhatsapp:c.phone,phoneRaw:c.phone,city:c.city,country:c.phone.startsWith("+237")?"Cameroun":c.phone.startsWith("+33")?"France":null,customerType:c.internal?"OTHER":p.classification==="CONSIGNMENT"?"PARTNER":"B2C",status:"CUSTOMER",isInternal:c.internal,source:"MASTER_GESTION_V6",notes:"Identité source conservée; aucun rapprochement ambigu."});
  return id;
}

async function groupCost(tx:any,groupId:string){
  const a=rows(await tx.execute(sql`SELECT a.lot_id,a.sku,a.type,a.pack_size,a.qty_delta,c.unit_cost_xaf FROM stock_movement_lot_allocations a LEFT JOIN stock_lot_cost_basis c ON c.lot_id=a.lot_id AND c.sku=a.sku AND c.type=a.type AND c.pack_size=a.pack_size WHERE a.group_id=${groupId} AND a.balance_field='onHand' AND a.qty_delta<0`));
  if(!a.length)refuse("SALE_ALLOCATION_MISSING");
  return {known:a.every(c=>c.unit_cost_xaf!==null),knownCostXaf:a.reduce((n,c)=>n-Number(c.qty_delta)*Number(c.unit_cost_xaf??0),0),allocations:a};
}

export async function importCommercial(tx:any,op:V6Operation){
  const p=op.payload;validateCommercial(p);
  const customerId=await customerFor(tx,p),consignment=p.classification==="CONSIGNMENT",locationId=stableId("location:unknown");
  let depositLocationId:string|undefined;
  if(consignment){
    depositLocationId=stableId(`location:${p.depositLocation.code}`);
    await tx.insert(stockLocations).values({locationId:depositLocationId,code:p.depositLocation.code,name:p.depositLocation.name,category:"PARTNER",notes:p.depositLocation.evidence});
    await tx.insert(stockConsignments).values({consignmentId:p.orderId,customerId,locationId:depositLocationId,occurredAt:date(p.date),commercialValueXaf:p.netXaf,sourceRecordId:op.source_record_id,payload:p});
  }
  const lineTargets:any[]=[],allGroups:string[]=[];
  for(const l of p.lines){
    const components:any[]=[];let known=true,cost=0;
    for(const c of l.components){
      if(c.stockType===null){
        if(!Number.isFinite(c.sourceLineCostXaf)||c.sourceLineCostXaf<0)refuse("SERVICE_COST_UNKNOWN");
        cost+=c.sourceLineCostXaf;components.push({...c,costKnown:true,derivedCostXaf:c.sourceLineCostXaf,groupId:null});continue;
      }
      const common={author:"V6_IMPORT",referenceType:"ORDER" as const,referenceId:p.orderId,referenceLabel:c.source_record_id,movementDate:date(p.date),motif:p.classification,comment:c.label,sku:c.sku,type:c.stockType,packSize:c.packSize,qty:c.quantity,sourceLocationId:locationId};
      const moved=await stockStorage.applyLocationMovement(consignment?{...common,movementType:"MISE_EN_DEPOT",destinationLocationId:depositLocationId!}:{...common,movementType:"VENTE"},tx);
      allGroups.push(moved.groupId);
      const costing=await groupCost(tx,moved.groupId);known=known&&costing.known;cost+=costing.knownCostXaf;
      components.push({...c,groupId:moved.groupId,costKnown:costing.known,derivedCostXaf:costing.known?costing.knownCostXaf:null,knownCostXaf:costing.knownCostXaf,allocations:costing.allocations});
    }
    lineTargets.push({sourceRecordId:l.source_record_id,itemId:stableId(l.source_record_id),costKnown:known,costXaf:known?cost:null,knownCostXaf:cost,components});
  }
  if(!consignment){
    const known=lineTargets.every(l=>l.costKnown),exactCost=lineTargets.reduce((n,l)=>n+l.knownCostXaf,0),cost=known?Math.round(exactCost):null,margin=cost===null?null:p.netXaf-cost;
    await tx.insert(orders).values({orderId:p.orderId,customerId,orderDate:date(p.date),status:p.balanceXaf===0?"PAID":"CONFIRMED",currency:"XAF",subtotalRegularTotalXaf:p.grossXaf,productDiscountsTotalXaf:p.discountXaf,subtotalAfterDiscountsXaf:p.netXaf,extraCustomerDiscountXaf:0,finalSaleTotalXaf:p.netXaf,totalCostXaf:cost,grossMarginXaf:margin,grossMarginRate:margin!==null&&p.netXaf>0?(margin/p.netXaf).toFixed(4):null,amountPaid:p.paidXaf,balanceDue:p.balanceXaf,paymentDate:p.payments.length?date(p.payments.map((c:any)=>c.date).sort().at(-1)):null,source:"historical_import",sourceSystem:"MASTER_GESTION_V6",sourceRecordId:op.source_record_id,sourceRowHash:hash(op),importBatchId:stableId("V6_IMPORT"),notes:JSON.stringify({classification:p.classification,sourceRows:p.sourceCommercialRows,sourceNotes:p.sourceNotes,costMethod:"FIFO_LOTS_CORRECTED_V6",costComplete:known})});
    for(let i=0;i<p.lines.length;i++){
      const l=p.lines[i],t=lineTargets[i],sourceCost=l.components.reduce((n:number,c:any)=>n+Number(c.sourceLineCostXaf),0),standardCost=l.components.reduce((n:number,c:any)=>n+Number(c.sourceUnitCostXaf)*c.quantity,0),simple=l.components.length===1,component=t.components[0],derived=t.costXaf===null?null:Math.round(t.costXaf);
      await tx.insert(orderItems).values({orderItemId:t.itemId,orderId:p.orderId,itemType:l.itemType,itemSku:l.itemSku,customLabel:l.itemType==="CUSTOM"?l.label:null,brand:simple?component.brand:null,series:simple?component.series:null,vitole:simple?component.vitole:null,quantity:l.quantity,regularUnitPriceXaf:l.grossXaf/l.quantity,effectiveUnitPriceXaf:l.grossXaf/l.quantity,lineSubtotalXaf:l.grossXaf,allocatedOrderDiscountXaf:l.discountXaf,actualLineRevenueXaf:l.netXaf,actualUnitPriceXaf:l.netXaf/l.quantity,standardUnitCostXaf:(standardCost/l.quantity).toFixed(4),standardLineCostXaf:standardCost.toFixed(4),actualLineCostXaf:sourceCost.toFixed(4),costVarianceVsStandardXaf:(sourceCost-standardCost).toFixed(4),unitCostAtSaleXaf:derived===null?null:Math.round(derived/l.quantity),totalCostXaf:derived,lineMarginXaf:derived===null?null:l.netXaf-derived,marginRate:derived===null||l.netXaf===0?null:((l.netXaf-derived)/l.netXaf).toFixed(4),sourceSystem:"MASTER_GESTION_V6",sourceRecordId:l.source_record_id,stockDisposition:simple&&component.stockType?"CONSUME":l.itemType==="SERVICE"?"NON_STOCK":null,stockType:simple?component.stockType:null,stockPackSize:simple?component.packSize:null,stockSourceLocationId:simple&&component.stockType?locationId:null,stockMovementGroupId:simple?component.groupId:null,stockNonConsumptionReason:l.itemType==="SERVICE"?"SERVICE_HISTORIQUE":null});
      for(const c of t.components)await tx.insert(orderItemComponents).values({orderItemComponentId:stableId(c.source_record_id),orderItemId:t.itemId,componentSku:c.sku,componentType:c.stockType===null?"SERVICE":c.stockType==="Accessory"?"ACCESSORY":c.sku.startsWith("CTCG-BDL-")?"BUNDLE":c.stockType==="Box"?"CIGAR_BOX":"OTHER",componentLabel:c.label||c.sku,quantityPerItem:c.quantity/l.quantity,totalQuantity:c.quantity,unitCostAtSaleXaf:c.derivedCostXaf===null?null:Math.round(c.derivedCostXaf/c.quantity)});
    }
  }
  for(const cash of p.payments){
    if(consignment)await tx.insert(consignmentCashEntries).values({cashEntryId:stableId(cash.source_record_id),consignmentId:p.orderId,amountXaf:cash.amountXaf,occurredAt:date(cash.date),reference:cash.source_record_id,note:"Avance sur consignation; aucun chiffre d'affaires reconnu."});
    else await appendCashEntry(tx,{orderId:p.orderId,entryType:"RECEIPT",amountXaf:cash.amountXaf,occurredAt:date(cash.date),author:"V6_IMPORT",reference:cash.source_record_id,note:"Encaissement historique V6, date source conservée."});
  }
  return {orderId:p.orderId,consignment,customerId,groups:allGroups,lines:lineTargets,netXaf:p.netXaf,cashXaf:p.paidXaf,costKnown:lineTargets.every(l=>l.costKnown)};
}

export async function importClosingAdjustment(tx:any,op:V6Operation){
  const p=op.payload,locationId=stableId("location:unknown"),common={sku:p.sku,type:p.type,packSize:p.packSize,author:"V6_IMPORT",referenceType:"OTHER" as const,referenceId:stableId(op.source_record_id),referenceLabel:op.source_record_id,movementDate:null,motif:"LEGACY_ADJUSTMENT",comment:p.reason};
  if(op.kind==="reclass"){
    const result=await stockStorage.applyLocationMovement({...common,movementType:"RECLASSEMENT_HISTORIQUE",qty:p.quantity,sourceLocationId:stableId(`location:${p.depositLocationCode}`),destinationLocationId:locationId},tx);
    return {groupId:result.groupId,ownedDelta:0};
  }
  const balance=rows(await tx.execute(sql`SELECT on_hand_qty FROM stock_location_balances WHERE location_id=${locationId} AND sku=${p.sku} AND type=${p.type} AND pack_size=${p.packSize} FOR UPDATE`));
  if(!balance.length||Number(balance[0].on_hand_qty)+p.delta<0)refuse("CLOSING_ADJUSTMENT_STOCK");
  const result=await stockStorage.applyLocationMovement({...common,movementType:"CORRECTION_INVENTAIRE",qty:Number(balance[0].on_hand_qty)+p.delta,sourceLocationId:locationId},tx);
  return {groupId:result.groupId,ownedDelta:p.delta};
}
