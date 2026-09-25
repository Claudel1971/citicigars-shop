# CLOSE-04 — Stock Phase 2 debt closure

Scope: generic internal transfer, physical bundle/sampler decomposition, manual-sale cancellation by compensation.

## Invariants preserved
- Stock ledger remains append-only: no UPDATE/DELETE of stock_movement_groups, stock_movements or stock_movement_lot_allocations.
- Aggregate, location and lot projections are updated atomically inside the existing StockStorage transactions.
- Existing evidenced FIFO ordering remains the default allocator: RECEIPT lots by receivedAt, OTHER by createdAt, LEGACY_UNKNOWN last, lotId as deterministic tie-breaker.
- No cost, margin, cash or weighted-average-cost reconstruction is performed in CLOSE-04.

## 1. TRANSFERT_INTERNE
A generic transfer moves the same stock identity (sku/type/packSize) from one physical location to another.
- Source and destination must both exist and be distinct.
- Aggregate onHand is unchanged: one negative and one positive append-only effect are recorded in the same movement group.
- Location projections decrease/increase respectively.
- Lot allocations are preserved exactly at destination.
- If lotId is supplied, that exact source lot is moved and must have sufficient available stock.
- If lotId is omitted, the existing deterministic evidenced FIFO planner selects source lots.
- Reserved stock is excluded through availableNow; a transfer cannot consume stock committed to client/event reservations.
No cost-average recalculation is performed because ownership inventory quantity is only relocated, not acquired or consumed.

## 2. DESASSEMBLAGE_COMPOSITE — bundle/sampler
The physical bundle SKU is treated as a Pack whose packSize must equal the sum of the bundle composition quantities.
- The bundle Pack is consumed first from the specified physical location, using the exact source lot when supplied or FIFO otherwise.
- The source allocation rows are then read back inside the same DB transaction.
- For every actually consumed source lot, each component product SKU is created as Loose stock in the same location, using the same provenance lot id.
- Component quantities equal composition quantity × number of bundles consumed from that source lot.
- The whole operation is atomic: if any component lacks a canonical productSku/stock SKU, has invalid quantity, or any stock leg fails, the source bundle consumption rolls back.
- No duplicate productSku is double-counted: duplicate component rows are aggregated by SKU before writing.
- No cost allocation from bundle to components is attempted. Allocation of historical/current carrying cost belongs to CLOSE-05.

## 3. ANNULATION_VENTE
Destructive sale deletion is disabled.
- POST /api/crm/sales/:id/cancel requires author + reason.
- Only manual sales are handled by this contract.
- The original order and original VENTE movement groups remain unchanged.
- For each consumed order line, the exact negative onHand lot allocations written by the original sale are read.
- Compensation restores those exact lot ids to those exact original locations; no new FIFO is run on cancellation.
- Total lot quantity to restore must exactly equal the order-line sold quantity, otherwise the operation fails closed.
- New ANNULATION_VENTE movement groups are appended and reference the original ORDER/order item.
- The order state becomes CANCELLED only after all compensation legs succeed in the same transaction.
- Repeated cancellation is idempotent and returns the already-created ANNULATION_VENTE groups.
- If amountPaid > 0, cancellation is blocked with an explicit CLOSE-05 dependency because reversing cash is outside CLOSE-04.

## Migration
0022_close04_stock_compensation.sql only extends the MySQL movement_type enums with TRANSFERT_INTERNE and ANNULATION_VENTE.
The migration is committed but is not executed by CLOSE-04 and must not be run in production without the governed deployment/migration gate.

## Test coverage
- Pure aggregate conservation and reservation protection for TRANSFERT_INTERNE.
- Deterministic evidenced FIFO source-lot selection.
- Physical bundle pack-size derivation, exact component expansion, and failure on missing component stock identity.
- Exact-lot/location sale compensation planning and positive append-only ANNULATION_VENTE effect.
- Stock route tests use the current HMAC/RBAC admin token rather than the retired legacy base64 token.
