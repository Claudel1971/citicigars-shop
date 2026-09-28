/** Derived presentation only. Unknown source components stay null. */
export function purchaseCostBreakdown(source:any) {
 const finite=(v:any)=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
 const q=finite(source?.quantity),money=source?.money;
 const net=finite(money?.net_total_xaf??money?.net_xaf),landed=finite(source?.exactLandedXaf),payment=finite(money?.payment_total),original=finite(money?.net_total??money?.net);
 return {netUnitXaf:q&&q>0&&net!==null?net/q:null,allocatedFeesXaf:net!==null&&landed!==null?landed-net:null,allocatedFeesUnitXaf:q&&q>0&&net!==null&&landed!==null?(landed-net)/q:null,effectiveCardRate:payment!==null&&original!==null&&original>0?payment/original:null,cardXafRate:finite(money?.payment_xaf_rate),directXafRate:finite(money?.xaf_rate)};
}
