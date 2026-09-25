# CLOSE-04 — Stock Phase 2 debt closure

**Scope:** transfer between locations/lots, physical bundle decomposition, append-only sale cancellation.  
**Branch:** `replit-commerce-os-v2`  
**Production migration/deployment:** explicitly not executed.

## 1. Generic internal transfer

Endpoint: `POST /api/admin/stock/movements` with `movementType=TRANSFERT_INTERNE`.

Contract:
- source and destination locations are both mandatory and must differ;
- only unreserved `onHand` is eligible;
- source lots are selected by the existing evidenced FIFO policy:
  1. receipt-backed lots first;
  2. `receivedAt` oldest first;
  3. then `createdAt`;
  4. then `lotId` as deterministic tie-breaker;
  5. `LEGACY_UNKNOWN` last;
- the exact selected lot IDs are decremented at source and incremented at destination;
- aggregate onHand is net zero; location and lot projections change;
- one append-only movement group records the operation; no historical ledger row is rewritten.

Cost/CMP:
- no cost calculation or average-cost rebuild is performed in CLOSE-04;
- provenance follows the exact transferred lots, so a future CLOSE-05 cost engine can preserve their cost basis without reconstructing FIFO.

## 2. Physical bundle / sampler decomposition

Endpoint: `POST /api/admin/stock/bundles/:sku/decompose`.

Physical identity:
- a physical bundle is the existing bundle SKU held as Stock Central `Pack`;
- `bundlePackSize` must equal the sum of the live bundle composition quantities;
- every component must have a real `productSku` present in the stock catalogue;
- components are materialized as `Loose` units at the same physical location.

Atomic flow:
1. consume the requested number of bundle Packs using Stock Central FIFO;
2. read the exact source lot allocations written for the consumed bundle Packs;
3. create component Loose stock in the same transaction;
4. component quantities inherit those exact source lot IDs, preserving provenance;
5. every source/component ledger row uses `DESASSEMBLAGE_COMPOSITE` and shares one operation reference ID.

No double counting:
- source bundle Pack inventory decreases first inside the same transaction;
- component Loose inventory increases by exactly `bundleItem.quantite × bundle quantity`;
- any validation failure rolls the whole transaction back.

Cost/CMP:
- CLOSE-04 does not allocate the bundle acquisition cost across components and does not modify CMP;
- that financial allocation belongs to CLOSE-05.
- physical provenance is retained so CLOSE-05 can perform the allocation without fabricating history.

## 3. Sale cancellation / compensation

Endpoint: `POST /api/crm/sales/:id/cancel` with `author` and mandatory `reason`.

Contract:
- destructive deletion of a recorded manual sale is disabled;
- cancellation locks the order and is idempotent once status is `CANCELLED`;
- each consumed order line must have its original Stock Central movement group;
- the service reads the original `stock_movement_lot_allocations`;
- only negative `onHand` allocations from the original sale are eligible for physical compensation;
- the sum of those allocations must equal the quantity sold;
- each compensation credits the exact original lot and original location using `ANNULATION_VENTE`;
- the original `VENTE` rows remain immutable;
- new positive append-only ledger rows are created and the order is marked `CANCELLED`.

FIFO:
- cancellation does **not** run a fresh FIFO.
- it reverses the exact physical lot allocations selected by FIFO at sale time.
- this prevents returning stock into a newer or unrelated lot.

Paid-sale boundary:
- if `amountPaid > 0`, CLOSE-04 fails closed.
- refund/cash reversal belongs to CLOSE-05 and is not fabricated here.

Cost/CMP:
- CLOSE-04 does not rewrite historical sale cost/margin fields;
- no new average-cost calculation is performed.

## 4. Schema migration prepared, not executed

`migrations-mysql/0022_close04_stock_compensation.sql` extends only the movement enum vocabulary with:
- `TRANSFERT_INTERNE`
- `ANNULATION_VENTE`

Existing `ASSEMBLAGE_COMPOSITE` / `DESASSEMBLAGE_COMPOSITE` values are reused.

No production migration was run.

## 5. Tests

- `server/services/stock-movement-processor.test.ts`: transfer net-zero/availability, distinct endpoints, append-only compensation effect.
- `server/services/stock-close04.test.ts`: FIFO lot plan, bundle component expansion, missing component identity failure, exact-lot sale compensation and quantity contract.

The test files are committed. No deployment-oriented workflow or production DB was invoked.
