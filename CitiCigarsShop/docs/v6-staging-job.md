# V6 staging job — draft, no business writes implemented

## First executable gate

The read-only preflight runs inside the existing staging API process, using its
existing pool. No HTTP route, external MySQL access, extra infrastructure or
credentials are introduced. Render administration is the activation control.
It is disabled unless explicitly enabled, pinned to the deployed commit, service
ID/name, exact database URL path and actual SELECT DATABASE() result. A two-hour
maximum expiry bounds reactivation on restarts. No raw errors, credentials,
customer names or payloads enter logs. Every source fact emits a hashed identity,
payload hash and qualification status. The manifest is supplied privately through
Render configuration, not committed to this public repository.

PS0 restoration was reported successful by the owner on 2026-09-27 in an isolated
restore-test database (258 queries). Do not require direct WHC access again.

Configuration: V6_JOB_ENABLED=true; V6_JOB_MODE=preflight;
V6_JOB_COMMIT=the deployed 40-character commit;
V6_JOB_EXPIRES_AT=an ISO timestamp within two hours;
V6_JOB_MANIFEST_GZIP=base64 gzip of the private metadata manifest;
V6_JOB_MANIFEST_SHA256=SHA-256 of its uncompressed JSON bytes.
MYSQL_URL is reused without reading or changing its secret value.

This version rejects every write mode. IDENTITY_PASS proves only the database
identity for this read-only connection. DRY_RUN_COMPLETE reports source/model
blockers; it is not an executable PS2–PS5 simulation, mutation approval or UAT PASS.

## Required write implementation and qualification

Do not enable business writes until the phase adapters are implemented, tested,
and the source exceptions have explicit dispositions. Reuse purchasing, stock
and cash services, adding an injected shared transaction where required. Never
disable ledger triggers, truncate fixture data, or force paid balances to totals.

Use an InnoDB import operation registry with a unique (source_system,
source_record_id), payload hash, phase, result identity, actor and audit timestamps.
For each operation, acquire its row lock in the same transaction as the business
writes; a matching committed hash skips, a conflicting hash stops, and a rollback
leaves no completed marker. Serialize the batch with a database advisory lock on
the same connection. Request UUIDs derive from the source ID; they do not replace
the unique source-record constraint. DDL is a separately reviewed staging-only
migration outside transactional replay.

Dry-run must compile the exact typed operation plan, validate all dependencies and
schema, compare existing source hashes, simulate stock conservation and produce
an immutable plan hash. Apply must bind that hash to a fresh identity/schema and
baseline check. Read-only preflight alone is insufficient for apply.

PS2: Hilands, Casa, Drugstore purchases and receipts. One global Casa receipt.
Resolve quantity unit mappings and preserve uncertain cost/date provenance.
PS3: chronological transformations, movements, deposits and explicitly authorized
legacy bridges. Inferred initial stock is a control, never an extra receipt.
PS4: real sales, free market-penetration transactions, dated receipts, receivables
and separate deposit advances. A deposit is not a sale.
PS5: per-source purchase/stock/sales/cash/ledger reconciliation; verify unchanged
pre-existing fixtures; rerun with zero business changes; run existing tests and UI.

Critical unresolved model issues: purchase dates currently require a precise day,
cash entries require an order, and some source acquisition costs are disputed or
missing. Do not invent dates, sales or costs to satisfy these fields.

Pause between operations/phases, persist progress transactionally, and stop on
any exception or reconciliation mismatch. Resume only through the same hashes
and operation registry. Logs identify start, dry-run, apply, skip, rollback,
reconciliation and completion without secrets; detailed private evidence remains
in the protected audit store. Disable the flag immediately after each attended
session. After qualification remove the startup hook/job, clear private job
configuration, deploy and verify removal. Retain append-only historical evidence.
