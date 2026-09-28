import {describe,it,expect} from 'vitest';
import {purchaseCostBreakdown} from './purchase-cost-breakdown';
describe('purchase cost explanation',()=>{
 it('reconciles original net, card payment and allocated landed fees',()=>{expect(purchaseCostBreakdown({quantity:2,exactLandedXaf:40000,money:{net_total:40,net_total_xaf:30000,payment_total:60,payment_xaf_rate:500}})).toEqual({netUnitXaf:15000,allocatedFeesXaf:10000,allocatedFeesUnitXaf:5000,effectiveCardRate:1.5,cardXafRate:500,directXafRate:null});});
 it('does not fabricate a missing fee or conversion and preserves known zero fees',()=>{expect(purchaseCostBreakdown({quantity:2,money:{net_total_xaf:100}}).allocatedFeesXaf).toBeNull();expect(purchaseCostBreakdown({quantity:2,exactLandedXaf:100,money:{net_total_xaf:100}}).allocatedFeesXaf).toBe(0);expect(purchaseCostBreakdown({quantity:0,money:{net_total_xaf:100}}).netUnitXaf).toBeNull();});
});
