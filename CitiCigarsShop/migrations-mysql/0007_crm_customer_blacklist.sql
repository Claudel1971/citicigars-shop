ALTER TABLE customers
  ADD COLUMN is_blacklisted BOOLEAN NOT NULL DEFAULT FALSE AFTER is_internal,
  ADD COLUMN blacklist_reason VARCHAR(500) NULL AFTER is_blacklisted,
  ADD COLUMN blacklisted_at TIMESTAMP NULL AFTER blacklist_reason;

CREATE INDEX idx_customers_blacklisted
  ON customers (is_blacklisted);
