# V6 staging migration — retired administrative capability

The temporary importer is retained as versioned audit source in server/jobs, but is no longer imported or invoked by server/index.ts. There is no execution HTTP route. Runtime V6_WRITE_* and V6_JOB_* configuration must be disabled and private payloads cleared after qualification.

The attended run used an exact Render service ID, database name bwljrj22_citicigars_admin_staging, deployed commit, expiry, plan hash, baseline hash and schema hash. Dry-run executes the plan transactionally and rolls it back. Operations are journaled by source_record_id with immutable payload hashes; mismatched replay fails closed. Business writes and journal markers share a transaction. Reconciliation follows each new commit and the complete replay. Unknown source dates, historical locations and unsupported costs remain explicitly unknown.

PS2 imports purchase receipts and original gross/discount/net costs. PS3 reconstructs transformations and documented legacy opening bridges. PS4 imports commercial orders, cash and deposits separately. PS5 reconciles current stock to the source controls and qualifies authenticated read views. Source payloads and detailed evidence belong only in the private Control Pack, never this public repository.

Persistent historical audit views remain authenticated. They expose original source costs alongside corrected inventory valuation. Unresolved cost is null, never silently replaced by a source estimate. Deposits and advances remain distinct from sales revenue.

Reactivation requires a new reviewed code change restoring an entry point, fresh technical identity proof, a new dry-run, and freshly approved expected hashes. Production is outside this mandate.
