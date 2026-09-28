import { sql } from "drizzle-orm";
import { db } from "../db.mysql";
const rows=(r:any):any[]=>r[0];
const parse=(x:any)=>typeof x==="string"?JSON.parse(x):x;
export async function getHistoricalAudit(){
  const consignments=rows(await db.execute(sql`SELECT s.consignment_id,s.occurred_at,s.commercial_value_xaf,c.first_name,c.last_name,COALESCE(SUM(a.amount_xaf),0) AS advance_xaf FROM stock_consignments s JOIN customers c ON c.customer_id=s.customer_id LEFT JOIN consignment_cash_entries a ON a.consignment_id=s.consignment_id GROUP BY s.consignment_id,s.occurred_at,s.commercial_value_xaf,c.first_name,c.last_name ORDER BY s.occurred_at`));
  const journal=rows(await db.execute(sql`SELECT source_record_id,phase,payload_json,target_json FROM v6_import_journal WHERE source_system='MASTER_GESTION' ORDER BY source_record_id`));
  const purchases=journal.filter(j=>j.source_record_id.startsWith("MG:PURCHASE_ORDER:")).flatMap(j=>{
    const p=parse(j.payload_json);
    return p.lines.map((l:any)=>({supplier:p.supplierCode.replace(/^V6_/,""),sku:l.sku,quantity:l.quantity,currency:l.money?.currency??null,gross:l.money?.gross_total??l.money?.gross??null,discount:l.money?.discount_total??l.money?.discount??null,net:l.money?.net_total??l.money?.net??null,netXaf:l.money?.net_total_xaf??l.money?.net_xaf??null,cardCurrency:l.money?.payment_currency??null,cardAmount:l.money?.payment_total??null,landedUnitCostXaf:l.unitCostXaf,landedTotalXaf:l.exact_landed_xaf}));
  });
  const advances=consignments.map(c=>({id:c.consignment_id,date:c.occurred_at,customer:`${c.first_name??""} ${c.last_name??""}`.trim(),valueXaf:Number(c.commercial_value_xaf),advanceXaf:Number(c.advance_xaf),balanceXaf:Number(c.commercial_value_xaf)-Number(c.advance_xaf)}));
  const incomplete=journal.filter(j=>j.phase==="PS4"&&parse(j.target_json).costKnown===false).length;
  return {consignments:advances,purchases,incompleteCostTransactions:incomplete,completedOperations:journal.length};
}
