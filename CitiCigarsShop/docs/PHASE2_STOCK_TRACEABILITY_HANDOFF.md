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
7. Movement group metadata and receipt/lot foundations were completed in Milestones 2–3; explicit location operations are completed in Milestone 4. Read APIs, CRM integration, and admin UX remain later sequential milestones.
8. Milestone 4 adds `applyLocationMovement` beside the legacy writer. Its TypeScript input union and runtime guards require the physical source for decrements, the destination for inbound stock, and both distinct endpoints for true transfers.
9. The allocation policy is evidenced FIFO: receipt lots sort by `received_at`, then other evidenced lots by creation time; `LEGACY_UNKNOWN` sorts last because its real age is unknowable. Creation time and `lot_id` are deterministic tie-breakers.
10. The global lock order is aggregate identity first, affected locations by lexical `location_id`, then lot positions in the deterministic allocation order. All affected rows are locked before projection mutations.
11. Reservations and releases retain identical source/destination metadata and alter reservation overlays at one location only. Physical transfers carry the same lot identity from source to destination.
12. Location-aware inbound operations accept an evidenced lot only when its receipt item identity and receipt destination match. Omitting a lot explicitly records unknown provenance; no provenance or location fact is inferred.
13. The aggregate projection and DNA read path are unchanged. The location-aware writer reconciles aggregate-to-location and location-to-lot inside its transaction before immutable ledger insertion.

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
- `server/services/stock-movement-processor.ts` — added location endpoint rules plus the deterministic evidenced-FIFO lot allocation planner.
- `server/services/stock-movement-processor.test.ts` — added focused endpoint, transfer, reservation-locality, FIFO, tie-breaker, and insufficient-allocation coverage.
- `server/storage.stock.ts` — added the location-aware transactional writer with explicit endpoints, stable aggregate/location/lot locking, same-lot transfers, atomic reconciliation, and append-only multi-lot allocations while preserving the legacy writer.
- `scripts/rehearsal-verify-stock-central-m4.mjs` — added the dedicated real-MariaDB Milestone 4 gate.

- `server/services/stock-traceability-model.ts` — strict identity/pagination parsing, explicit zero semantics, derived availability, deterministic ordering, allocation arithmetic status, and fail-closed three-projection reconciliation.
- `server/services/stock-traceability.ts` — snapshot-consistent read models for aggregate summary, current physical/provenance traceability, bounded history, and full movement-group traces without a parallel datastore.
- `server/services/stock-traceability-model.test.ts` — focused Milestone 5 contract and consistency tests.
- `server/routes.stock-traceability.ts` — read-only admin Stock Central routes using the existing CMS admin authentication middleware.
- `server/routes.ts` — registered the Milestone 5 route module.
- `scripts/rehearsal-verify-stock-traceability-m5.mjs` — controlled real-MariaDB/HTTP stock-life rehearsal for the operational read layer.

- `client/src/components/admin/StockAdmin.tsx` — operational list/search, exact-identity detail, location/provenance views, reconciliation warning, immutable history, movement-group detail, confirmation, and post-write M5 refresh.
- `client/src/components/admin/stock-admin-model.ts` — UI operation definitions, validation, error mapping, unknown-location labels, and write-then-refresh sequencing.
- `client/src/components/admin/StockAdmin.test.tsx` — focused component/model coverage.
- `client/src/components/admin/AdminSidebar.jsx` and `client/src/pages/Admin.jsx` — protected `/admin/stock` navigation and screen.
- `server/routes.stock-admin.ts` — minimal authenticated stock list/location/reception-lot reads and generic M4-backed movement POST.
- `server/routes.stock-admin.test.ts` — route auth, payload, delegation, domain-error, and concurrency-error tests.
- `server/services/stock-traceability.ts` — searchable stock positions, explicit no-position rows, active locations, and eligible evidenced reception lots.
- `scripts/rehearsal-verify-stock-admin-m6.mjs` — real-MariaDB HTTP operational lifecycle rehearsal.
- `vitest.config.ts` — focused frontend test inclusion and frontend alias.

- `shared/schema.sales.ts` — added the nullable historical-compatible M7 stock contract and unique movement-group link on `order_items`.
- `server/services/manual-sale.ts` — validates every line before mutation, persists durable request/line idempotency, creates the CRM order and all M4 `VENTE` groups in one transaction, applies stable cross-line lock ordering, and blocks destructive deletion after stock consumption.
- `server/services/manual-sale.test.ts` — focused exact identity, sentinel, source, non-stock, bundle, and zero-revenue fail-closed coverage.
- `server/routes.crm.ts` — returns 201 for a new sale and 200 for a durable idempotent replay.
- `client/src/components/admin/crm/NewSale.jsx` and `NewSale.d.ts` — require operator, exact type/pack size, and source location by code/name/category; retain the retry key after failure; exclude ambiguous bundle entry; label automatic M4 FIFO explicitly.
- `client/src/components/admin/crm/NewSale.test.tsx` — focused physical and `NON_STOCK` rendering coverage.
- `scripts/rehearsal-verify-crm-stock-m7.mjs` — controlled real-MariaDB Box+Pack, FIFO, retry, projection, reference, and insufficient-second-line rollback proof.
- `migrations-mysql/0020_crm_sale_stock_contract.sql` and journal index 19 — forward-only M7 line contract; no historical row is backfilled or inferred.

- `shared/schema.stock.ts` — adds minimal purchase orders/items, durable PO/receipt request identity, PO links on historical-compatible receipt rows, and `RECEIPT` movement references.
- `server/services/purchasing.ts` — owns supplier validation, exact PO lines, derived outstanding quantities, partial receipts, durable idempotency, evidenced lot creation, stable line order, and one-transaction M4 `RECEPTION` orchestration.
- `server/routes.purchasing.ts` — thin authenticated supplier, PO, and receipt API; all stock effects remain in the service and M4 writer.
- `client/src/components/admin/PurchasingAdmin.tsx` — minimal `/admin/purchasing` operator workflow with explicit destination, exact line quantities, confirmation, receipt history, and post-success read refresh.
- `scripts/rehearsal-verify-purchasing-m8.mjs` — controlled real-MariaDB partial receipt, retry, over-receipt, rollback, M5 evidence, M7 FIFO cross-flow, and global projection proof.
- Focused M8 route/service/UI tests cover supplier and identity validation, required PO/destination evidence, auth, retry status, conflict mapping, partial progress, and confirmation semantics.

## 6. Migrations created

- `migrations-mysql/0016_stock_locations_foundation.sql` with journal entry index 15.
- The migration preserves `stock_balances`, creates `LEGACY_UNKNOWN`, copies every aggregate row and all six buckets into that explicit unknown location, and adds location-balance insert/update guards matching the existing aggregate rules.
- `migrations-mysql/0017_stock_movement_groups.sql` with journal entry index 16.
- Migration `0017` backfills one header from the earliest detail row in each historical group while leaving historical source/destination locations `NULL`; it then enforces matching `(group_id, movement_type)` and makes headers append-only.
- `migrations-mysql/0018_stock_provenance_lots.sql` with journal entry index 17.
- Migration `0018` creates one explicit `LEGACY_UNKNOWN` provenance lot with every unsupported historical fact (`supplier`, `receipt`, source reference, receipt date) left `NULL`, backfills current location positions into it, and creates no historical movement/lot allocations.
- `migrations-mysql/0019_crm_customer_blacklist_repair.sql` with journal entry index 18.
- Migration `0019` conditionally creates the three blacklist columns and their index. It is safe both for a fresh database, where the unjournaled historical migration was skipped, and for a database where that historical SQL was applied manually.
- `migrations-mysql/0020_crm_sale_stock_contract.sql` with journal entry index 19.
- Migration `0020` adds nullable `stock_disposition`, `stock_type`, `stock_pack_size`, `stock_source_location_id`, `stock_movement_group_id`, and `stock_non_consumption_reason` columns to `order_items`, plus source/group foreign keys and a unique movement-group link. Nullable columns preserve historical rows exactly; M7 performs no historical backfill.
- `migrations-mysql/0021_purchasing_receiving.sql` with journal entry index 20.
- Migration `0021` creates `stock_purchase_orders` and exact `stock_purchase_order_items`; adds nullable PO/idempotency links to existing receipt history; adds `purchase_order_item_id` to receipt items; and extends movement reference enums with `RECEIPT`. Existing rows remain unchanged and no supplier, PO, cost, receipt, location, or provenance fact is backfilled or inferred.

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
  - id 20, `0020_crm_sale_stock_contract`, hash prefix `e52f9c527dfc`, timestamp `1787716800000`.
  - id 21, `0021_purchasing_receiving`, hash prefix `751ebfe19bf6`, timestamp `1787803200000`.
- The first disposable `0021` run executed its DDL but then reported `ER_EMPTY_QUERY` because the file ended with an extra statement breakpoint, so Drizzle had not journaled it. The partially applied M8 objects were audited and removed only from the disposable database, the trailing empty statement was removed, and the real Drizzle runner then applied and journaled `0021` successfully. No old migration was rewritten.
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
- Milestone 4 focused Vitest (`npx.cmd vitest run --config vitest.config.ts server/services/stock-movement-processor.test.ts`): PASS — 1 file, 58 tests passed.
- Milestone 4 real-MariaDB rehearsal (`npx.cmd tsx scripts/rehearsal-verify-stock-central-m4.mjs`): PASS — 16 OK, 0 FAIL. It covers required endpoints, two physical locations plus an event location, multiple receipt lots, evidenced FIFO, DNA aggregate compatibility, insufficient-stock rollback, reservation without relocation, deposit/return, event sortie/return, location-specific correction, concurrent consumption of the same lots, transfer metadata, and allocation arithmetic.
- Final fresh-chain legacy backend rehearsal remained PASS — 45 OK, 0 FAIL.
- Final fresh-chain seed atomicity remained PASS — 8 OK, 0 FAIL.
- Final append-only trigger rehearsal remained PASS — detail, group, and allocation UPDATE/DELETE attempts all rejected.
- Final direct SQL reconciliation after the complete gate: 47 aggregate rows with 0 aggregate/location mismatches; 49 location rows with 0 location/lot mismatches.
- Final `npm.cmd run check`: PASS. Final production build: PASS — 1,937 client modules and `dist/index.cjs`; only the existing chunk-size warning. Final `git diff --check`: PASS.

### Milestone 5 final gate

- Focused Phase 2 Vitest: PASS — 2 files, 69 tests passed.
- Milestone 5 HTTP/read rehearsal: PASS — 20 OK, 0 FAIL.
- Environment: MariaDB 12.3.2 at `127.0.0.1:3399`, database `citicigars_rehearsal`, using the documented disposable data directory. No new migration was required for M5; the read layer used the already-applied schema through `0019`, including Phase 2 migrations `0016`, `0017`, and `0018`.
- Controlled story: explicit unknown reception; evidenced lot A and later lot B into STORE; client reservation; FIFO sale; STORE-to-PARTNER transfer and return; event reservation, sortie, and return; location-specific correction.
- Security/status/edge cases: admin auth 401; stable 404 for unknown SKU/group; empty known-SKU summary; explicit zero exact identity; 400 for invalid identities and excessive history limit.
- Every controlled group had matching details; every allocation reconciled; aggregate/location/lot reported `RECONCILED`; repeated reads left all ledger counts unchanged.
- Milestone 4 MariaDB regression: PASS — 16 OK, 0 FAIL.
- Existing backend rehearsal: PASS — 45 OK, 0 FAIL.
- Seed atomicity: PASS — 8 OK, 0 FAIL.
- Append-only trigger rehearsal: PASS — UPDATE and DELETE rejected for details, group headers, and allocations.
- Final SQL: 45 aggregate rows, 0 aggregate/location mismatches; 45 location rows, 0 location/lot mismatches.
- Final TypeScript check, production build, and `git diff --check`: PASS. Build produced 1,937 client modules and `dist/index.cjs`; only the existing chunk warning remained.

### Milestone 5 endpoint and query contract

- `GET /api/admin/stock/:sku` returns SKU/product identity and deterministic aggregate positions. Optional `type`/`packSize` preserve exact stock identity. Known/no-stock is not an error; an exact absent position is explicit zero.
- `GET /api/admin/stock/:sku/traceability` requires an exact identity and returns aggregate buckets, non-zero current locations, non-zero current lot/location provenance, reconciliation, and bounded chronological operations with details and allocations.
- `GET /api/admin/stock/movements/:groupId` returns one complete immutable operation with endpoints, details, allocations in ledger insertion order, and allocation consistency.
- The combined trace endpoint intentionally replaces separate location/lot/history endpoints so consumers receive one coherent point-in-time answer.
- All routes are read-only and protected by existing `requireAdminAuth`. DNA continues reading unchanged aggregate stock.
- Trace queries run in one MariaDB/InnoDB transaction snapshot and batch-load operation data without N+1 queries.
- History order: `COALESCE(movement_date, created_at)`, `created_at`, `group_id`. Detail/allocation order: numeric `id`. Locations: code/ID. Lots: location code, receipt time, lot creation time, lot ID.
- Pagination: offset, default limit 50, maximum 100, default offset 0, exact total.
- Zero location/lot rows reconcile but are omitted from current arrays. `LEGACY_UNKNOWN` and null evidence are returned literally; nothing is inferred.
- Projection mismatch fails with HTTP 409 `stock_traceability_inconsistent`.
- Accepted M5 limitation: bounded offset pagination. Reporting, mutations, UI, CRM integration, purchasing, and dashboards remain out of scope.

### Milestone 6 final gate

- Admin screen: `/admin/stock`, inside the existing authenticated admin shell.
- New protected reads: `GET /api/admin/stock?search=`, `GET /api/admin/stock/locations`, and `GET /api/admin/stock/reception-lots`.
- New protected write: `POST /api/admin/stock/movements`. It parses, checks the SKU, delegates exactly once to `stockStorage.applyLocationMovement`, and returns the immutable `groupId`; it has no stock-effect or allocation logic.
- Exact M4 forms: `RECEPTION`, `MISE_EN_DEPOT`, `RETOUR_DE_DEPOT`, `RESERVATION_CLIENT`, `LIBERATION_RESERVATION_CLIENT`, `RESERVATION_EVENEMENT`, `SORTIE_EVENEMENT`, `RETOUR_EVENEMENT`, and counted-target `CORRECTION_INVENTAIRE` with mandatory reason.
- Outbound allocation stays automatic evidenced FIFO in M4. Reception offers only existing receipt lots matching identity/destination, plus explicit `Legacy / provenance inconnue`; M6 creates no evidence.
- Locations use code/name/category selectors, never operator-entered UUIDs. `LEGACY_UNKNOWN` remains explicit.
- Writes require confirmation, perform no optimistic update, show the group ID, then refresh M5 state and history.
- Stable actionable errors are surfaced; expected stock/concurrency conflicts use 409, invalid requests use 400/404, raw SQL is hidden, and traceability 409 is a visible blocking warning.
- Focused final suite: PASS — 4 files, 82 tests (8 frontend, 5 admin route, 11 M5 model, 58 M4 processor).
- M6 HTTP/MariaDB: PASS — 36 OK, 0 FAIL. Two receptions, client reserve/release, deposit transfer/return, event reserve/sortie/partial return, and correction ran through the admin POST with M5 proof after every operation.
- M5: 20/20; M4: 16/16; backend: 45/45; seed atomicity: 8/8; append-only triggers: PASS.
- Final SQL: 45 aggregate rows and 45 location rows; zero projection mismatches.
- TypeScript, production build, and diff checks: PASS. Build: 1,939 frontend modules plus server `dist/index.cjs`; existing chunk warning only.
- Environment: disposable/local MariaDB 12.3.2, `127.0.0.1:3399`, `citicigars_rehearsal`. No M6 migration; schema remained through `0019`.

### Milestone 6 limitations

- M4 has no generic business movement for arbitrary same-bucket `onHand → onHand`. M6 does not invent `TRANSFER`; it exposes typed deposit and event transfers that preserve lot identity.
- Evidence creation is absent. A new evidenced reception requires existing receipt/lot evidence; otherwise provenance must explicitly remain unknown. Purchasing/receiving is later scope.
- Search is bounded to 100 rows and includes no analytics/dashboard layer.

### Milestone 7 CRM -> Stock contract and final gate

- Exact decrement trigger: stock decrements when an authenticated operator creates a new manual CRM sale through `POST /api/crm/sales` and the order commits as `CONFIRMED` or `PAID`. Drafts, cancelled orders, historical imports, checkout/WhatsApp prospects, and existing historical rows are not processed by M7.
- Exact consuming-line contract: stable `orderId`, stable `orderItemId`, `SKU`, `type`, `packSize`, positive `quantity`, explicit active `sourceLocationId`, `movementType=VENTE`, `referenceType=ORDER`, `referenceId=orderId`, `referenceLabel=orderItemId`, and explicit operator `author`. Lot is never entered or guessed by CRM; M4 allocates evidenced eligible lots by its deterministic receipt FIFO policy.
- Classification: new `PRODUCT` and `ACCESSORY` lines must explicitly be `CONSUME`; accessories require `Accessory/0`; cigar products cannot use `Accessory`. `SERVICE` and `CUSTOM` must explicitly be `NON_STOCK` with a reason and no physical identity/location fields. `BUNDLE` is rejected until an exact component/decomposition contract exists. Stock-consuming zero-revenue records are rejected.
- Source treatment: every consuming line requires an active location selected by code/name/category. No store, Douala, highest-balance location, first location, lot, or provenance is inferred. `LEGACY_UNKNOWN` remains usable only when the operator explicitly selects that visible active location.
- Durable idempotency: the browser creates one UUID and retains it across failures/retries. The order persists it as `(source_system='crm_manual_sale_stock_v1', source_record_id=clientRequestId)` under the existing unique index, with a SHA-256 normalized payload hash. A matching retry returns the existing order with HTTP 200; reuse with different content fails. Every consuming order item also persists one unique `stock_movement_group_id`.
- Transaction/locking: customer/order/items, every M4 stock mutation, line/group links, and customer status transition share one MariaDB transaction. All external SKU/location facts are validated before the first movement. Consuming lines run in binary stable `(SKU,type,packSize,sourceLocationId,orderItemId)` order; M4 then performs its stable aggregate/location/FIFO-lot locks. Any line failure rolls back the CRM order and every stock projection/ledger/allocation from earlier lines.
- Reversal: deleting a manual sale that has a `CONSUME` line is blocked. M7 does not invent a reversal; a future explicit compensating operation is required.
- Migration gate: `0020` was applied successfully with the real Drizzle migration runner only to disposable MariaDB 12.3.2 at `127.0.0.1:3399`, database `citicigars_rehearsal`, data directory `C:/Users/claud/AppData/Local/Temp/citicigars-phase2-mariadb-3399/`, local TCP with grant tables disabled. The six columns were verified through `information_schema`; journal id 20/hash prefix/timestamp are recorded above.
- Focused M4-M7 Vitest: PASS — 6 files, 89 tests.
- M7 real-MariaDB rehearsal: PASS — 18 OK, 0 FAIL. Four evidenced lots (old/new Box and Pack), one explicit physical store, one customer, and a two-line Box+Pack sale proved exact saved contracts, two immutable `VENTE` groups, `ORDER`/line references, selected source metadata, old-then-new FIFO, and both reconciliation levels.
- Retry proof: same UUID returned the same order and created zero additional orders, items, groups, movements, allocations, or decrements.
- Failure proof: a second request with sufficient Box first and insufficient Pack second failed; no CRM order survived, all ledger counts were unchanged, and aggregate/location/lot quantities for both identities were unchanged.
- Regression: M6 36/36; M5 20/20; M4 16/16; backend 45/45; seed atomicity 8/8; append-only detail/group/allocation UPDATE and DELETE checks all rejected.
- Final direct SQL: 45 aggregate, 45 location, and 45 lot rows; 0 aggregate/location mismatches and 0 location/lot mismatches.
- Final TypeScript, production build, and `git diff --check`: PASS. Build produced 1,939 frontend modules and `dist/index.cjs`; only the existing Vite chunk-size warning remained.
- No staging/production access, deployment, migration, historical backfill, purchasing, or admin-dashboard expansion occurred.

### Milestone 7 remaining limitations

- Bundles cannot be sold through the M7 integrated manual form until each physical component has an exact identity, quantity, and source-location contract.
- There is no explicit compensating CRM sale reversal yet; stock-linked sale deletion is blocked.
- The previously documented generic CitiCigars location-to-location transfer debt remains separate and must be closed before the final M10 E2E if still required.
- Available quantity is not cached or inferred in the sale form. The server/M4 transaction remains the authoritative availability check and returns an actionable insufficient-stock error; Stock Admin/M5 remains available for inspection.

### Milestone 8 Purchasing / Receiving architecture and final gate

- Audit result: the trustworthy foundation already contained minimal suppliers, receipts, immutable receipt items, evidenced provenance lots, explicit locations, M4 `RECEPTION`, and M5 supplier/receipt/lot/location reads. It lacked a purchase-order entity, ordered/outstanding quantities, PO lifecycle, durable receipt orchestration, and receiving UI/API. Existing product prices are not trustworthy purchasing costs, so M8 persists no inferred unit cost, currency, landed cost, or accounting fact.
- Supplier model stays deliberately small: UUID, unique operator-entered code, name, optional notes, active flag, and timestamps. No supplier CRM or payment model was added. Unknown/inactive suppliers fail closed; the controlled rehearsal creates suppliers A and B and never chooses one implicitly.
- PO model: UUID/code, supplier, ordered/expected dates, `DRAFT|ORDERED|PARTIALLY_RECEIVED|RECEIVED|CANCELLED`, optional reference/notes, operator, request UUID/hash, and exact unique `(SKU,type,packSize)` lines with positive ordered quantity. M8 creates operational POs as `ORDERED`; received/outstanding quantities are derived from immutable receipt items rather than cached.
- Direct receipt decision: no repository evidence established a direct-without-PO business need. New M8 receipts therefore require an exact PO; the nullable schema links only preserve historical compatibility and do not authorize invented POs.
- Partial receipt policy: allowed. Each physical receipt remains a distinct event and PO status becomes `PARTIALLY_RECEIVED` until every line is exactly complete, then `RECEIVED`. Omitted lines simply remain outstanding.
- Over-receipt policy: blocked without override. The service locks the PO, derives prior received quantities, and rejects any line above its outstanding quantity before creating receipt evidence.
- Provenance policy: exactly one new non-system `RECEIPT` lot per receipt item. The lot links to the exact receipt and is never `LEGACY_UNKNOWN`. Every line invokes M4 with `movementType=RECEPTION`, explicit destination and lot, `referenceType=RECEIPT`, `referenceId=receiptId`, and `referenceLabel=receiptItemId`; the resulting immutable group is therefore derivable without mutating receipt history.
- Transaction and ordering: one MariaDB transaction contains receipt, items, lots, every M4 group/detail/allocation/projection mutation, and final PO status. The PO row is locked `FOR UPDATE`; validated receipt lines are sorted by binary exact identity plus PO item ID before any M4 mutation. M4 retains its stable aggregate/location/lot locks and reconciliation. Any later-line failure rolls back all earlier receipt and stock writes.
- Durable idempotency: PO and receipt submissions each require a UUID protected by a unique index plus SHA-256 of the normalized business payload. An identical retry returns the existing record with HTTP 200 and makes zero writes; reuse with changed content fails `idempotency_payload_mismatch`. Browser receipt request IDs survive failed attempts and are replaced only after success.
- API: protected `GET/POST /api/admin/purchasing/suppliers`, `PUT /api/admin/purchasing/suppliers/:id`, `GET/POST /api/admin/purchasing/orders`, `GET /api/admin/purchasing/orders/:id`, `GET/POST /api/admin/purchasing/receipts`, and `GET /api/admin/purchasing/receipts/:id`. Routes delegate to the purchasing service and existing `requireAdminAuth`.
- UI: `/admin/purchasing` in the existing admin shell provides supplier creation/listing, exact PO creation, ordered/received/outstanding progress, explicit destination/operator/date receipt entry, a confirmation summary, receipt history with lot and movement IDs, no optimistic stock update, and Stock M5 cache refresh after confirmed success.
- Focused final M4–M8 Vitest: PASS — 9 files, 99 tests. M8-only final run: 3 files, 10 tests. The first combined command without `MYSQL_URL` produced two import-time environment failures while 89 tests passed; rerunning with the explicit disposable URL passed all tests.
- M8 real-MariaDB rehearsal: PASS — 26 OK, 0 FAIL. PO-1 ordered Box 10 and Pack(5) 6; receipt 1 accepted 6/2 and remained partial; identical retry added nothing; changed-payload retry failed closed; attempted Box 5 over the remaining 4 changed nothing; receipt 2 accepted 4/4 and completed the PO.
- Evidence proof: both receipts created one lot and one M4 group per line. M5 returned the exact supplier, receipt, two chronologically distinct Box lots, explicit destination, and movement references. No new evidenced receipt used `LEGACY_UNKNOWN`.
- Atomic rollback proof: a controlled two-line receipt wrote a valid Box line first and then failed on an invalid physical Loose line; the transaction left no receipt, item, lot, group, movement, allocation, stock increase, or PO status change.
- M8→M7 cross-flow: a later CRM sale of seven Box units allocated `-6` from the first M8 receipt lot and `-1` from the newer lot. Immutable `ORDER` sale references and `RECEIPT` provenance coexist, and the final Box projection was aggregate 3 = destination 3 = lots 3.
- Full real-MariaDB regression: M4 16/16; M5 20/20; M6 36/36; M7 18/18; existing backend 45/45; seed atomicity 8/8; append-only UPDATE/DELETE rejection passed for groups, details, and lot allocations.
- Final global SQL after M8: 49 aggregate identities with 0 aggregate/location mismatches; 49 location identities with 0 location/lot mismatches. Environment: MariaDB `12.3.2-MariaDB`, `127.0.0.1:3399`, database `citicigars_rehearsal`, journal id 21/hash prefix/timestamp recorded above.
- Final `npm.cmd run check`, production `npm.cmd run build`, and `git diff --check`: PASS. Build produced 1,940 frontend modules and `dist/index.cjs`; only the existing Vite chunk-size warning remained.
- No staging/production access, deployment, real supplier import, historical receipt backfill, purchasing accounting, CRM reversal, generic transfer work, dashboard, monitoring, forecasting, or Milestone 9 work occurred.

### Milestone 8 remaining limitations

- Direct/manual receipt without a PO is intentionally unavailable until CitiCigars provides evidence that the workflow is required and defines its controls.
- Expected/unit/landed costs and currency are intentionally absent because no trustworthy purchasing cost model was established.
- PO editing/cancellation/approval and supplier accounting are outside this minimal receiving workflow.
- Generic location transfer, bundle component decomposition, and compensating reversal for stock-linked sales remain the previously documented open debts.

## 9. Commits created

- `345133d docs: define phase 2 stock traceability architecture`
- `7aa3139 stock: add physical location foundation`
- `73c30d5 docs: checkpoint phase 2 location foundation`
- `1e01687 stock: add movement group traceability`
- `368a076 docs: checkpoint phase 2 movement groups`
- `bb76d13 stock: add receipt and provenance lot foundation`
- `b86b3d6 docs: checkpoint phase 2 provenance foundation`
- `9802f2f db: repair disposable migration chain`
- `67fd4ca stock: add deterministic multi-location lot allocation`
- `71bc6a5 stock: add operational traceability reads`
- `194f42e stock: add operational admin back-office`
- `0420e15 crm: consume exact stock for confirmed sales`
- `1faf2ed stock: add atomic purchasing and receiving`

## 10. Current status

- Milestone 0 architecture audit is complete and committed.
- Milestone 1 implementation is complete and committed; it passes focused tests, TypeScript, build, syntax, and diff checks.
- Milestone 2 implementation is complete and committed; it passes focused tests, TypeScript, build, syntax, and diff checks.
- Milestone 3 implementation is complete and committed; it passes focused tests, TypeScript, build, syntax, and diff checks.
- The real disposable MariaDB gate is complete for Milestones 1–4.
- Migrations `0016`, `0017`, `0018`, and the necessary forward repair `0019` were applied only to the local disposable rehearsal database.
- All required database, rollback, concurrency, projection, immutability, type-check, focused unit-test, build, and diff checks pass.
- Milestone 4 implementation and its full disposable MariaDB gate are complete.
- Milestone 5 read/traceability API and its full disposable MariaDB gate are complete.
- Milestone 6 operational Stock Admin and its full disposable MariaDB gate are complete.
- Milestone 7 CRM sale-to-stock integration and its full disposable MariaDB gate are complete.
- Migration `0020` was applied only to disposable/local MariaDB; no staging or production access was included.
- Milestone 8 purchasing/receiving and its full disposable MariaDB gate are complete and committed.
- Migration `0021` was applied and journaled only on disposable/local MariaDB; no staging or production access was included.

## 11. Unresolved risks/questions

- Existing untracked repository artifacts are extensive. Always use path-specific staging and confirm the staged diff before committing.
- The legacy writer intentionally remains scoped to `LEGACY_UNKNOWN`; evidenced physical operations must use `applyLocationMovement` and must never silently fall back to an invented real location or receipt lot.
- The rehearsal discovered that `0007_crm_customer_blacklist.sql` was historically absent from `meta/_journal.json`; `0019` is the forward-only guarded repair. Do not retroactively insert `0007` into the old journal position.
- New purchasing receipts must continue to require exact PO, supplier, identity, quantity, destination, date, operator, receipt item, and non-legacy provenance evidence; nullable historical columns are not permission to fabricate missing facts.
- Milestone 9 must consume reconciled operational read models and must not mutate ledger/projections, infer missing evidence, or silently mask projection inconsistencies.

## 12. NEXT EXACT ACTION

Begin Milestone 9 — Stock Management / Monitoring / Operational Indicators, only after explicit authorization. Keep monitoring read-only over reconciled M4–M8 facts; do not infer missing provenance, begin production deployment, or absorb the remaining transfer/bundle/reversal debts without explicit scope.

## 13. Commands required to resume safely

From the repository root:

```powershell
git branch --show-current
git fetch origin phase2-stock-traceability:refs/remotes/origin/phase2-stock-traceability
git merge-base HEAD origin/phase2-stock-traceability
git status --short
Set-Location .\CitiCigarsShop
npx.cmd vitest run --config vitest.config.ts server/services/stock-movement-processor.test.ts
npx.cmd vitest run --config vitest.config.ts server/services/stock-traceability-model.test.ts server/services/stock-movement-processor.test.ts
npx.cmd vitest run --config vitest.config.ts server/services/stock-movement-processor.test.ts server/services/stock-traceability-model.test.ts server/routes.stock-admin.test.ts server/services/manual-sale.test.ts client/src/components/admin/StockAdmin.test.tsx client/src/components/admin/crm/NewSale.test.tsx server/services/purchasing.test.ts server/routes.purchasing.test.ts client/src/components/admin/PurchasingAdmin.test.tsx
npm.cmd run check
npm.cmd run build
npx.cmd tsx scripts/rehearsal-verify-stock-traceability-m5.mjs
npx.cmd tsx scripts/rehearsal-verify-stock-admin-m6.mjs
npx.cmd tsx scripts/rehearsal-verify-crm-stock-m7.mjs
npx.cmd tsx scripts/rehearsal-verify-purchasing-m8.mjs
npx.cmd tsx scripts/rehearsal-verify-stock-central-backend.mjs
npx.cmd tsx scripts/rehearsal-verify-stock-central-m4.mjs
npx.cmd tsx scripts/rehearsal-verify-seed-atomicity.mjs
node scripts/rehearsal-verify-0005-immutability.mjs
git diff --check
```

Expected branch: `codex/phase2-stock-traceability` (or another `codex/phase2-stock-traceability-*` worktree) based on `origin/phase2-stock-traceability`. Never stage or modify unrelated untracked files.
