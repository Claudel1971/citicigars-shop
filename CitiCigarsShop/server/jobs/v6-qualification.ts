import { issueAdminToken } from "../middleware/auth";
import { queryTransactions } from "../services/transaction-explorer";
import type { V6Plan } from "./v6-import";
function fail(code:string):never{throw Object.assign(new Error(code),{safeCode:code});}
export async function qualifyStagingViews(plan:V6Plan){
  // Ephemeral read-only token stays in process and is never returned or logged.
  const token=issueAdminToken("AUDITOR").token;
  const base=`http://127.0.0.1:${Number(process.env.PORT||5000)}`;
  const endpoints=["/api/admin/stock","/api/admin/purchasing/orders","/api/admin/purchasing/receipts","/api/crm/customers","/api/crm/historical-audit"];
  const checks:any[]=[];
  for(const path of endpoints){
    const anonymous=await fetch(base+path,{signal:AbortSignal.timeout(15000)});
    if(anonymous.status!==401)fail("UNAUTHENTICATED_VIEW_EXPOSED");
    await anonymous.arrayBuffer();
    const authorized=await fetch(base+path,{headers:{"x-cms-token":token},signal:AbortSignal.timeout(15000)});
    if(authorized.status!==200||!authorized.headers.get("content-type")?.includes("application/json"))fail("AUTHENTICATED_VIEW_FAILURE");
    const body:any=await authorized.json();
    if(path.endsWith("historical-audit")&&(body.consignments.length!==plan.expected.consignmentCount||body.purchases.length!==plan.expected.purchase_lines||body.completedOperations!==plan.operations.length))fail("AUDIT_VIEW_RECONCILIATION");
    checks.push({path,anonymousStatus:anonymous.status,authorizedStatus:authorized.status});
  }
  const sourceIds=new Set(plan.operations.filter(o=>o.kind==="commercial"&&o.payload.classification!=="CONSIGNMENT").map(o=>o.payload.orderId));
  const transactions=(await queryTransactions({})).filter(r=>sourceIds.has(r.orderId));
  if(new Set(transactions.map(r=>r.orderId)).size!==plan.expected.salesCount||transactions.reduce((n,r)=>n+r.actualLineRevenueXaf,0)!==plan.expected.revenueXaf)fail("TRANSACTION_VIEW_RECONCILIATION");
  const page=await fetch(base+"/admin",{signal:AbortSignal.timeout(15000)}),html=await page.text();
  if(page.status!==200||!html.includes('<div id="root"'))fail("ADMIN_ASSET_FAILURE");
  const asset=html.match(/<script[^>]+src="([^\"]+)"/);
  if(!asset||!asset[1].startsWith("/assets/"))fail("ADMIN_SCRIPT_MISSING");
  const script=await fetch(base+asset[1],{signal:AbortSignal.timeout(15000)});
  if(script.status!==200)fail("ADMIN_SCRIPT_FAILURE");await script.arrayBuffer();
  return {checks,transactionOrders:sourceIds.size,transactionLines:transactions.length,incompleteCostLines:transactions.filter(r=>r.valuationLineCostXaf===null).length,adminHtmlStatus:page.status,adminScriptStatus:script.status};
}
