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
4. Backfill the newly created location projection from aggregate balances into `LEGACY_UNKNOWN` once. Migration `0016` is forward-only like the existing project migrations and fails on conflicting pre-existing objects rather than overwriting them.
5. Starting in Milestone 1, the existing storage writer must lock and update both aggregate and legacy-unknown location rows inside the same transaction. This prevents two independent sources of truth during the transition to explicit locations.
6. Reservations remain at the same physical location: location projections carry reservation buckets, but reservation movements do not relocate quantities.
7. Explicit source/destination locations, movement group metadata, receipts/lots, APIs, CRM integration, and admin UX remain later sequential milestones.

## 5. Files changed

- `docs/PHASE2_STOCK_TRACEABILITY_HANDOFF.md` — created and updated at each checkpoint.
- `shared/schema.stock.ts` — added location constants, `stock_locations`, and `stock_location_balances`.
- `server/services/stock-movement-processor.ts` — added pure location projection summing/reconciliation guard.
- `server/services/stock-movement-processor.test.ts` — added location reconciliation and reservation-location tests.
- `server/storage.stock.ts` — locks, validates, and writes aggregate plus legacy-unknown location projections in one transaction; multi-row opening preserves stable projection/identity lock order.
- `scripts/rehearsal-verify-stock-central-backend.mjs` — extended disposable-DB rehearsal assertions for location projection and rollback.
- `migrations-mysql/0016_stock_locations_foundation.sql` — created physical location tables, explicit unknown seed, aggregate backfill, FKs, indexes, and portable balance-rule triggers.
- `migrations-mysql/meta/_journal.json` — added journal index 15 for migration `0016`.
- `migrations-mysql/0017_stock_movement_groups.sql` — added append-only business-operation headers, non-fabricating historical backfill, group/type FK, and immutability triggers.
- `migrations-mysql/meta/_journal.json` — subsequently added journal index 16 for migration `0017`.
- `scripts/rehearsal-verify-0005-immutability.mjs` — extended append-only proof to movement groups.
- `scripts/rehearsal-verify-seed-atomicity.mjs` — extended reset/rollback/final-count checks to both Phase 2 projections and movement groups.
- `migrations-mysql/0018_stock_provenance_lots.sql` — added suppliers, receipts, immutable receipt items, provenance lots, lot/location balances, append-only movement/lot allocations, explicit legacy lot seed, and backfill.
- `server/storage.stock.ts` — now maintains aggregate, location, and legacy-lot projections plus lot allocation ledger rows atomically.
- Stock rehearsal scripts — extended again for provenance reconciliation, allocation rollback/counting, and allocation immutability.
- `migrations-mysql/0015_research_pool.sql` — added the missing Drizzle statement breakpoints so a fresh journal-driven MariaDB migration run executes its multiple DDL statements correctly.
- `migrations-mysql/0019_crm_customer_blacklist_repair.sql` — added a guarded forward repair for the historical `0007_crm_customer_blacklist.sql` migration, which exists on disk but was never entered in the Drizzle journal.
- `migrations-mysql/meta/_journal.json` — added journal index 18 for the guarded `0019` repair.

## 6. Migrations created

- `migrations-mysql/0016_stock_locations_foundation.sql` with journal entry index 15.
- The migration preserves `stock_balances`, creates `LEGACY_UNKNOWN`, copies every aggregate row and all six buckets into that explicit unknown location, and adds location-balance insert/update guards matching the existing aggregate rules.
- `migrations-mysql/0017_stock_movement_groups.sql` with journal entry index 16.
- Migration `0017` backfills one header from the earliest detail row in each historical group while leaving historical source/destination locations `NULL`; it then enforces matching `(group_id, movement_type)` and makes headers append-only.
- `migrations-mysql/0018_stock_provenance_lots.sql` with journal entry index 17.
- Migration `0018` creates one explicit `LEGACY_UNKNOWN` provenance lot with every unsupported historical fact (`supplier`, `receipt`, source reference, receipt date) left `NULL`, backfills current location positions into it, and creates no historical movement/lot allocations.
- `migrations-mysql/0019_crm_customer_blacklist_repair.sql` with journal entry index 18.
- Migration `0019` conditionally creates the three blacklist columns and their index. It is safe both for a fresh database, where the unjournaled historical migration was skipped, and for a database where that historical SQL was applied manually.

## 7. Migration application status

- Applied only to a disposable local MariaDB 12.3.2 instance at `127.0.0.1:3399`, database `citicigars_rehearsal`.
- Disposable data directory: `C:/Users/claud/AppData/Local/Temp/citicigars-phase2-mariadb-3399/`.
- Server configuration used for the gate: `utf8mb4`, `utf8mb4_unicode_ci`, local TCP only, grant tables disabled for the disposable process.
- The database was rebuilt from zero after the migration fixes. The baseline helper marked `0000` as already represented, then the real `drizzle-kit migrate --config=drizzle.config.mysql.ts` command applied the complete remaining journal in one successful pass.
- The first fresh-chain attempt stopped at `0015_research_pool.sql`: that multi-statement migration lacked Drizzle statement breakpoints. Adding the missing breakpoints fixed the real migration runner failure.
- The first backend rehearsal then stopped in the CRM/DNA portion because `customers.is_blacklisted` was absent. The historical `0007_crm_customer_blacklist.sql` file had never been journaled, so the guarded forward migration `0019` was added. After both fixes, the database was rebuilt from zero and the complete gate passed. No Milestone 4 work was started.
- Phase 2 journal evidence from the final fresh run:
  - id 16, `0016_stock_locations_foundation`, hash prefix `4db94bc39ec7`, timestamp `1787623200000`;
  - id 17, `0017_stock_movement_groups`, hash prefix `ec36860e3dc4`, timestamp `1787626800000`;
  - id 18, `0018_stock_provenance_lots`, hash prefix `8d15ca349d30`, timestamp `1787630400000`;
  - id 19, `0019_crm_customer_blacklist_repair`, hash prefix `949fc0fcc5a8`, timestamp `1787634000000`.
- No staging or production database was accessed or modified.

## 8. Tests executed and exact results

- Branch/base/status safety checks: passed. The remote ref initially needed to be fetched; afterward `HEAD`, `origin/phase2-stock-traceability`, and merge-base all equalled `228fb8af04a1b93980fe5454e68d9e77cfe3dace`.
- `npm.cmd exec vitest run server/services/stock-movement-processor.test.ts`: PASS — latest run 1 file, 53 tests passed (Milestone 1 run was 50/50).
- `npm.cmd run check`: PASS — `tsc` exited 0.
- `npm.cmd run build`: PASS — client built 1,937 modules and server bundle `dist/index.cjs`; only the pre-existing Vite chunk-size warning was emitted.
- `node --check` for `rehearsal-verify-stock-central-backend.mjs`, `rehearsal-verify-0005-immutability.mjs`, and `rehearsal-verify-seed-atomicity.mjs`: PASS.
- `git diff --check`: PASS (line-ending conversion warnings only).
- Fresh disposable migration chain: PASS — migrations through `0019` applied successfully in one real Drizzle run.
- Extended Stock Central backend rehearsal (`npx.cmd tsx scripts/rehearsal-verify-stock-central-backend.mjs`): PASS — 45 OK, 0 FAIL.
- Seed atomicity rehearsal (`npx.cmd tsx scripts/rehearsal-verify-seed-atomicity.mjs`): PASS — 8 OK, 0 FAIL. The injected failure occurred at operation 141/257 and rolled back every seed-written stock, group, allocation, and projection row. A clean retry produced 59 movements, 54 groups, 59 allocations, and 45 rows in each projection.
- Append-only/immutability rehearsal (`node scripts/rehearsal-verify-0005-immutability.mjs`): PASS — UPDATE and DELETE were rejected for movement details, group headers, and lot allocations; all attempted records remained intact.
- Projection reconciliation queried directly in MariaDB after the rehearsals: PASS — 45 aggregate rows, 0 aggregate/location mismatches; 45 location rows, 0 location/lot mismatches.
- Rollback behavior against real MariaDB: PASS — failed reservation left aggregate, location, lot, movement, group, and allocation state unchanged; the injected seed failure also rolled back atomically.
- Concurrency behavior against real MariaDB: PASS — exactly one of two simultaneous reservations against one available unit succeeded, the other failed cleanly, and the final reserved quantity was 1.

## 9. Commits created

- `345133d docs: define phase 2 stock traceability architecture`
- `7aa3139 stock: add physical location foundation`
- `73c30d5 docs: checkpoint phase 2 location foundation`
- `1e01687 stock: add movement group traceability`
- `368a076 docs: checkpoint phase 2 movement groups`
- `bb76d13 stock: add receipt and provenance lot foundation`
- `b86b3d6 docs: checkpoint phase 2 provenance foundation`
- `9802f2f db: repair disposable migration chain`

## 10. Current status

- Milestone 0 architecture audit is complete and committed.
- Milestone 1 implementation is complete and committed; it passes focused tests, TypeScript, build, syntax, and diff checks.
- Milestone 2 implementation is complete and committed; it passes focused tests, TypeScript, build, syntax, and diff checks.
- Milestone 3 implementation is complete and committed; it passes focused tests, TypeScript, build, syntax, and diff checks.
- The real disposable MariaDB gate is complete for Milestones 1–3.
- Migrations `0016`, `0017`, `0018`, and the necessary forward repair `0019` were applied only to the local disposable rehearsal database.
- All required database, rollback, concurrency, projection, immutability, type-check, focused unit-test, build, and diff checks pass.
- Milestone 4 has not begun.

## 11. Unresolved risks/questions

- Existing untracked repository artifacts are extensive. Always use path-specific staging and confirm the staged diff before committing.
- The Milestone 3 schema can preserve multiple receipt lots, but the current writer intentionally supports only `LEGACY_UNKNOWN`; multi-lot locking/allocation policy and real location IDs must be implemented together in Milestone 4. The current reconciliation guard fails closed if another lot is introduced prematurely.
- The rehearsal discovered that `0007_crm_customer_blacklist.sql` was historically absent from `meta/_journal.json`; `0019` is the forward-only guarded repair. Do not retroactively insert `0007` into the old journal position.

## 12. NEXT EXACT ACTION

Begin Milestone 4: implement explicit multi-location operations and deterministic multi-lot allocation, preserving aggregate/location/lot reconciliation and stable lock ordering. Keep all validation disposable/local until a separate staging authorization is given.

## 13. Commands required to resume safely

From the repository root:

```powershell
git branch --show-current
git fetch origin phase2-stock-traceability:refs/remotes/origin/phase2-stock-traceability
git merge-base HEAD origin/phase2-stock-traceability
git status --short
Set-Location .\CitiCigarsShop
npx.cmd vitest run --config vitest.config.ts server/services/stock-movement-processor.test.ts
npm.cmd run check
npm.cmd run build
npx.cmd tsx scripts/rehearsal-verify-stock-central-backend.mjs
npx.cmd tsx scripts/rehearsal-verify-seed-atomicity.mjs
node scripts/rehearsal-verify-0005-immutability.mjs
git diff --check
```

Expected branch: `codex/phase2-stock-traceability` (or another `codex/phase2-stock-traceability-*` worktree) based on `origin/phase2-stock-traceability`. Never stage or modify unrelated untracked files.
