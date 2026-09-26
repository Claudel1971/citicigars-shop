-- CLOSE-05 only: append-only cash journal and immutable lot cost basis.
-- NOT executed by this change. Production migration remains explicitly out of scope.

CREATE TABLE `cash_journal_entries` (
  `cash_entry_id` varchar(36) NOT NULL,
  `order_id` varchar(36) NOT NULL,
  `entry_type` enum('RECEIPT','REFUND') NOT NULL,
  `amount_xaf` int NOT NULL,
  `occurred_at` timestamp NOT NULL,
  `author` varchar(100) NOT NULL,
  `reference` varchar(255) NOT NULL,
  `note` text NULL,
  `created_at` timestamp DEFAULT (now()),
  CONSTRAINT `cash_journal_entries_cash_entry_id` PRIMARY KEY (`cash_entry_id`),
  CONSTRAINT `fk_cash_journal_order` FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`order_id`) ON DELETE RESTRICT,
  CONSTRAINT `uq_cash_journal_reference` UNIQUE (`reference`),
  KEY `idx_cash_journal_order` (`order_id`,`occurred_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE `stock_lot_cost_basis` (
  `lot_id` varchar(36) NOT NULL,
  `sku` varchar(50) NOT NULL,
  `type` enum('Box','Pack','Loose','Accessory') NOT NULL,
  `pack_size` int NOT NULL DEFAULT 0,
  `unit_cost_xaf` decimal(14,4) NOT NULL,
  `source` enum('RECEIPT','BUNDLE_DERIVATION') NOT NULL,
  `source_reference` varchar(100) NULL,
  `created_at` timestamp DEFAULT (now()),
  CONSTRAINT `pk_stock_lot_cost_basis` PRIMARY KEY (`lot_id`,`sku`,`type`,`pack_size`),
  CONSTRAINT `fk_stock_lot_cost_lot` FOREIGN KEY (`lot_id`)
    REFERENCES `stock_provenance_lots` (`lot_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_lot_cost_sku` FOREIGN KEY (`sku`)
    REFERENCES `skus` (`sku`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  KEY `idx_stock_lot_cost_identity` (`sku`,`type`,`pack_size`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_cash_journal_entries_bu`;
--> statement-breakpoint
CREATE TRIGGER `trg_cash_journal_entries_bu` BEFORE UPDATE ON `cash_journal_entries`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'cash_journal_append_only';
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_cash_journal_entries_bd`;
--> statement-breakpoint
CREATE TRIGGER `trg_cash_journal_entries_bd` BEFORE DELETE ON `cash_journal_entries`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'cash_journal_append_only';
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_stock_lot_cost_basis_bu`;
--> statement-breakpoint
CREATE TRIGGER `trg_stock_lot_cost_basis_bu` BEFORE UPDATE ON `stock_lot_cost_basis`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'lot_cost_basis_immutable';
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_stock_lot_cost_basis_bd`;
--> statement-breakpoint
CREATE TRIGGER `trg_stock_lot_cost_basis_bd` BEFORE DELETE ON `stock_lot_cost_basis`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'lot_cost_basis_immutable';
END;
