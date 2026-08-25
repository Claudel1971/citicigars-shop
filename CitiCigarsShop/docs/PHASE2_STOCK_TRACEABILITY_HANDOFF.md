# Phase 2 Stock Traceability / OMS — Handoff

## 1. Mission objective

Extend the existing Stock Central ledger so CitiCigars can identify inventory provenance and physical location without breaking aggregate availability consumers. The ledger remains the historical truth; all balance tables remain transactionally maintained projections. Historical facts that are not supported by evidence must be represented as legacy/unknown, never inferred.

## 2. Branch and starting commit

- Repository root: `C:/Users/claud/OneDrive/Documents/CitiCigars_Claude_StockDNA_v1_20260812/citicigars-shop-git`
- Working app: `CitiCigarsShop/`
- Worktree branch: `codex/phase2-stock-traceability`
- Starting `HEAD`: `228fb8af04a1b93980fe5454e68d9e77cfe3dace`
- `origin/phase2-stock-traceability`: `228fb8af04a1b93980fe5454e68d9e77cfe3dace`
- Verified merge-base: `228fb8af04a1b93980fe5454e68d9e77cfe3dace`
- Gate result: the worktree is based exactly on the mandatory Phase 2 branch.
- Initial tracked status: clean. Many pre-existing untracked files are present and are out of scope; do not add, modify, or delete them.

## 3. Architecture discovered

- `shared/schema.stock.ts` defines the aggregate `stock_balances` projection keyed by `(sku, type, pack_size)`, the six lifecycle buckets, and append-only `stock_movements` detail rows grouped by UUID `group_id`.
- `server/services/stock-movement-processor.ts` contains pure effect/rule functions. It distinguishes physical quantities from reservation overlays and prevents negative buckets, invalid pack sentinels, Loose transit, and invalid opening distributions.
- `server/storage.stock.ts` is the sole Stock Central writer. It opens/reuses a DB transaction, creates and locks balance rows with `SELECT ... FOR UPDATE`, applies pure effects, writes balances, then inserts ledger rows atomically. `OUVERTURE_BOITE` locks all affected aggregate rows in stable `Box -> Pack(pack_size) -> Loose -> Accessory` order.
- Migration `0005_stock_central_triggers.sql` enforces balance sentinels and rejects `UPDATE`/`DELETE` on `stock_movements`; these protections must remain.
- DNA availability reads aggregate `stock_balances` directly, so its key/semantics must remain backward compatible.
- Current stock-facing HTTP capability is DNA availability only; there is no operational stock write/read admin API yet.
- `server/services/manual-sale.ts` creates confirmed/paid CRM orders and explicitly does not change stock because order lines do not capture stock type, pack size, or physical source location. This is the future CRM integration point, after location-aware operations are safe.
- Stock tests include pure Vitest coverage plus MariaDB rehearsal scripts covering atomic ledger writes, rollback, concurrency, stable multi-row operations, DNA reads, and append-only triggers.
- Migration files run through `0015_research_pool.sql`. The MySQL journal also ends at `0015` (journal index 14); the next coherent Phase 2 migration number is `0016`.

## 4. Decisions taken

1. Preserve `stock_balances` as the aggregate compatibility projection.
2. Add `stock_locations` plus `stock_location_balances`, keyed by `(location_id, sku, type, pack_size)`, with the same six buckets. This avoids changing DNA and other aggregate consumers.
3. Use a single explicit system location with code `LEGACY_UNKNOWN` for existing balances and for legacy callers that cannot yet supply a location. No Douala, supplier, address, or provenance fact will be fabricated.
4. Backfill the location projection from aggregate balances into `LEGACY_UNKNOWN` once. Make the migration reject an already-populated location projection whose totals disagree, rather than silently overwriting it.
5. Starting in Milestone 1, the existing storage writer must lock and update both aggregate and legacy-unknown location rows inside the same transaction. This prevents two independent sources of truth during the transition to explicit locations.
6. Reservations remain at the same physical location: location projections carry reservation buckets, but reservation movements do not relocate quantities.
7. Explicit source/destination locations, movement group metadata, receipts/lots, APIs, CRM integration, and admin UX remain later sequential milestones.

## 5. Files changed

- `docs/PHASE2_STOCK_TRACEABILITY_HANDOFF.md` — created at Milestone 0.

## 6. Migrations created

- None yet. Planned next: `migrations-mysql/0016_stock_locations_foundation.sql` and journal entry index 15.

## 7. Migration application status

- No Phase 2 migration has been applied anywhere.
- Production was not accessed.
- Any future application must target a disposable/local or staging database explicitly and be recorded here.

## 8. Tests executed and exact results

- No code tests yet at this audit-only checkpoint.
- Branch/base/status safety checks: passed, except the remote ref initially needed to be fetched; after fetch, the required merge-base matched exactly.

## 9. Commits created

- None yet.

## 10. Current status

- Milestone 0 architecture audit is complete.
- Handoff infrastructure is established.
- Milestone 1 design is decided and ready for implementation.

## 11. Unresolved risks/questions

- Location-level Loose maximum must be enforced consistently while retaining the existing aggregate maximum. The application will apply the same balance rules to both projections; portable DB triggers should mirror the existing aggregate trigger rules.
- Existing untracked repository artifacts are extensive. Always use path-specific staging and confirm the staged diff before committing.
- The local MariaDB rehearsal environment may not be running and has not been inspected or modified in this session.
- Provenance allocation across mixed lots is intentionally unresolved until Milestone 3; Milestone 1 must not encode a supplier shortcut.

## 12. NEXT EXACT ACTION

Implement Milestone 1: add schema and migration `0016` for `stock_locations` and `stock_location_balances`, add projection/reconciliation helpers and tests, then update `server/storage.stock.ts` so current operations maintain the aggregate and `LEGACY_UNKNOWN` location projections atomically with stable lock ordering.

## 13. Commands required to resume safely

From the repository root:

```powershell
git branch --show-current
git fetch origin phase2-stock-traceability:refs/remotes/origin/phase2-stock-traceability
git merge-base HEAD origin/phase2-stock-traceability
git status --short
Set-Location .\CitiCigarsShop
npm.cmd exec vitest run server/services/stock-movement-processor.test.ts
npm.cmd run check
npm.cmd run build
git diff --check
```

Expected branch: `codex/phase2-stock-traceability` (or another `codex/phase2-stock-traceability-*` worktree) based on `origin/phase2-stock-traceability`. Never stage or modify unrelated untracked files.
