-- Roll back application code first and pause administrative writes.
-- This rollback archives the additive tables instead of destroying their data.
-- Execute explicitly only; never include in an automatic migration glob.
DROP TRIGGER IF EXISTS admin_customer_business_id;
DROP TRIGGER IF EXISTS admin_supplier_business_id;
RENAME TABLE admin_business_identifiers TO rollback_0024_business_identifiers,
 admin_business_sequences TO rollback_0024_business_sequences,
 admin_technical_sheet_versions TO rollback_0024_sheet_versions,
 admin_tasks TO rollback_0024_tasks,
 admin_task_events TO rollback_0024_task_events;
-- Forward recovery: reverse these five renames and reinstall 0024b triggers.
