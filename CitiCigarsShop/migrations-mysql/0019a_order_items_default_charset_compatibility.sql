-- Compatibility bridge for legacy CRM databases whose order_items table
-- default still uses latin1. This changes only the defaults inherited by
-- columns added later; it deliberately does not use CONVERT TO CHARACTER SET
-- and therefore does not rewrite existing text columns or historical values.

ALTER TABLE `order_items`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
