-- Additive, explicitly applied only after a verified isolated-staging backup.
-- No existing PK/FK, ledger, lot, FIFO or customer row is modified.
CREATE TABLE IF NOT EXISTS admin_business_identifiers (
  kind ENUM('CUST','SUPP') NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  business_id VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(kind,entity_id), UNIQUE KEY uq_admin_business_id(business_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS admin_business_sequences (
  kind ENUM('CUST','SUPP') PRIMARY KEY,
  next_value INT NOT NULL
) ENGINE=InnoDB;
INSERT IGNORE INTO admin_business_sequences(kind,next_value) VALUES ('CUST',1),('SUPP',1);
CREATE TABLE IF NOT EXISTS admin_technical_sheet_versions (
  version_id CHAR(36) PRIMARY KEY,
  cigar_id VARCHAR(20) NOT NULL,
  source VARCHAR(500) NOT NULL,
  source_date DATE NULL,
  original_text MEDIUMTEXT NOT NULL,
  fields_json JSON NOT NULL,
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_admin_sheet_identity(cigar_id,created_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS admin_tasks (
  task_id CHAR(36) PRIMARY KEY,
  customer_id VARCHAR(36) NOT NULL,
  category ENUM('CONTACT_VERIFICATION','ADMIN_DOCUMENT','ACCOUNT_RECONCILIATION') NOT NULL,
  due_at DATE NOT NULL,
  responsible VARCHAR(100) NOT NULL,
  status ENUM('OPEN','DONE','CANCELLED') NOT NULL DEFAULT 'OPEN',
  version INT NOT NULL DEFAULT 1,
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_admin_task_due(status,due_at), KEY idx_admin_task_customer(customer_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS admin_task_events (
  event_id CHAR(36) PRIMARY KEY,
  task_id CHAR(36) NOT NULL,
  status ENUM('OPEN','DONE','CANCELLED') NOT NULL,
  actor VARCHAR(100) NOT NULL,
  version INT NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_admin_task_version(task_id,version)
) ENGINE=InnoDB;
