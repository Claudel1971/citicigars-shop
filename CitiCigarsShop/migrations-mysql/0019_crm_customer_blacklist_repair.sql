-- Repair for historical migration 0007_crm_customer_blacklist.sql, which was
-- committed but never entered in meta/_journal.json. This forward migration
-- is guarded so databases where 0007 was applied manually remain safe.

DROP PROCEDURE IF EXISTS `_ensure_customer_blacklist_columns`;
--> statement-breakpoint
CREATE PROCEDURE `_ensure_customer_blacklist_columns`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'is_blacklisted'
  ) THEN
    ALTER TABLE `customers`
      ADD COLUMN `is_blacklisted` BOOLEAN NOT NULL DEFAULT FALSE AFTER `is_internal`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'blacklist_reason'
  ) THEN
    ALTER TABLE `customers`
      ADD COLUMN `blacklist_reason` VARCHAR(500) NULL AFTER `is_blacklisted`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'blacklisted_at'
  ) THEN
    ALTER TABLE `customers`
      ADD COLUMN `blacklisted_at` TIMESTAMP NULL AFTER `blacklist_reason`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_customers_blacklisted'
  ) THEN
    CREATE INDEX `idx_customers_blacklisted` ON `customers` (`is_blacklisted`);
  END IF;
END
--> statement-breakpoint
CALL `_ensure_customer_blacklist_columns`();
--> statement-breakpoint
DROP PROCEDURE `_ensure_customer_blacklist_columns`;
