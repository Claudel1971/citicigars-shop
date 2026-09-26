# CLOSE-05 — Cash Journals, acquisition cost, FIFO COGS and gross margin

**Repository:** `Claudel1971/citicigars-shop`  
**Branch:** `replit-commerce-os-v2`  
**Scope:** CLOSE-05 only.  
**Deployment / production migration:** not executed.

## 1. Cash Journal — append-only

Table: `cash_journal_entries`.

Entry types:
- `RECEIPT`: cash received from a sale.
- `REFUND`: cash paid back to the customer.

Rules:
- stored amounts are positive XAF integers; entry type carries the economic sign;
- effective cash balance for one sale = receipts minus refunds;
- every entry has a unique reference for idempotency;
- application code only inserts entries;
- DB triggers reject UPDATE and DELETE;
- DB trigger rejects non-positive amounts.

A manual sale created with `amountPaid > 0` writes a `RECEIPT` entry in the same transaction as the sale. If the sale transaction rolls back, the cash entry also rolls back.

Audit API:
- `GET /api/crm/sales/:id/cash-journal`
- `POST /api/crm/sales/:id/refund`

A refund requires an explicit UUID request id, amount, author, refund date and reason. It creates a new `REFUND` entry; it never deletes or edits the original receipt.

### CLOSE-04 cancellation junction

`cancelManualSale` now checks the Cash Journal:
- uncollected sale / net cash balance = 0: cancellation may continue;
- collected sale with outstanding net cash: cancellation remains blocked;
- once refund entries bring the net cash balance to 0, CLOSE-04 stock compensation may run;
- a legacy sale with `amountPaid > 0` but no Cash Journal entry fails closed with a reconciliation-required error. No historical cash is fabricated.

The historical `orders.amount_paid` field remains a transaction-time snapshot. Refunds are represented only by new Cash Journal entries.

## 2. Acquisition cost — immutable lot cost basis

Table: `stock_lot_cost_basis`.

Key:
`(lot_id, sku, type, pack_size)`.

A receipt line may provide `acquisitionUnitCostXaf`.
- null: cost is unknown; no cost basis is created;
- explicit zero is allowed (e.g. genuinely free stock);
- a known value is recorded with four-decimal precision;
- the value is associated with the exact receipt lot and stock identity.

The basis is immutable:
- UPDATE and DELETE are blocked by DB triggers;
- direct inserts must use a non-negative cost and respect the Stock pack-size sentinel.

Receipt reads expose the cost basis when one exists.

No historical or legacy lot is retro-valued automatically.

## 3. FIFO COGS

COGS is never reconstructed from a global average.

For every sold stock line:
1. the sale's `stockMovementGroupId` is read;
2. its `stock_movement_lot_allocations` are loaded;
3. only negative `onHand` allocations are physical units sold;
4. each exact allocation is matched to `stock_lot_cost_basis` using:
   - lot id,
   - SKU,
   - stock type,
   - pack size;
5. line COGS = sum of `abs(qtyDelta) × unitCostXaf` for the exact FIFO lots consumed.

If any consumed allocation lacks a cost basis, the line COGS is unknown and no partial margin is fabricated.

For known COGS:
- `order_items.unit_cost_at_sale_xaf` stores the rounded weighted unit cost;
- `order_items.total_cost_xaf` stores line COGS;
- `order_items.line_margin_xaf = actual_line_revenue_xaf - COGS`;
- `order_items.margin_rate` stores the resulting rate.

Order-level COGS/margin is only populated when every order line has a complete calculable cost. Otherwise order-level cost and margin stay NULL.

## 4. Bundle / sampler cost inheritance

CLOSE-04 already preserves the source lot when a physical bundle Pack is decomposed.

CLOSE-05 adds cost inheritance:
- source identity: bundle SKU / `Pack` / exact `packSize`;
- if the source lot has a known Pack unit cost, each physical cigar created as `Loose` inherits:
  `bundle Pack unit cost / bundle packSize`;
- the derived basis remains attached to the same provenance lot;
- every component in that purchased sampler receives the same per-stick cost allocation because the acquisition price is known only at the sampler Pack level;
- if the source bundle cost is unknown, no derived component cost is created.

Example:
- sampler Pack cost = 24,000 XAF;
- Pack contains 6 cigars;
- derived component Loose cost = 4,000 XAF each.

This preserves the total acquisition cost of the purchased Pack across its physical components and does not use catalogue or sale prices.

Generic internal transfers require no cost rewrite because the same lot and stock identity are retained across locations.

## 5. Gross margin

Per sale:
- gross margin = sale revenue - FIFO COGS;
- margin rate = gross margin / sale revenue.

Period endpoint:
- `GET /api/crm/finance/margin-summary?from=<ISO>&to=<ISO>`

The summary excludes cancelled sales and reports:
- total sale count;
- count with fully known margin;
- incomplete sale count;
- total revenue;
- revenue belonging only to known-COGS sales;
- COGS on known-COGS sales;
- gross margin on known-COGS sales.

This prevents a misleading margin that would combine revenue from unknown-cost sales with only partial COGS.

## 6. Explicit limitations

1. **Legacy inventory:** if no evidenced acquisition cost exists for an old lot, COGS remains unknown. No reconstructed average is used.
2. **Legacy collected sales:** a pre-CLOSE-05 sale with `amountPaid > 0` but no Cash Journal entry cannot be automatically refunded/cancelled; manual reconciliation is required.
3. **Non-stock/service order lines:** new manual sales currently do not provide a sourced cost for service/custom non-stock lines. An order containing such a line therefore does not receive a complete order-level gross margin.
4. **Late landed-cost adjustments:** CLOSE-05 records the explicit acquisition unit cost supplied at receipt. It does not invent later freight/duty allocation when that data is absent.
5. **Legacy box-opening path:** the older `OUVERTURE_BOITE` writer predates the evidenced location/lot cost flow. CLOSE-05 does not redesign that stock path; cost is only calculated where exact consumed lot identity and basis are available.

## 7. Tests

`server/services/finance-close05.test.ts` covers:
- receipt/refund cash signs and net balance;
- cancellation gate before and after full refund;
- multi-lot FIFO COGS with different acquisition costs;
- fail-closed behavior when one lot cost is missing;
- acquisition cost normalization including explicit zero;
- sampler per-stick cost inheritance;
- gross-margin arithmetic.

`routes.purchasing.test.ts` was aligned with CLOSE-03 signed RBAC tokens to avoid a false regression.

Tests are committed but no deployment-oriented GitHub workflow and no production database were invoked.
