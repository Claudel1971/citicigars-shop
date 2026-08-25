-- Phase 2 / Milestone 3: minimal receipts and durable lot provenance.
-- No historical supplier, receipt, invoice, date or cost is inferred.

CREATE TABLE `stock_suppliers` (
  `supplier_id` varchar(36) NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `active` boolean NOT NULL DEFAULT true,
  `notes` text,
  `created_at` timestamp DEFAULT (now()),
  `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `stock_suppliers_supplier_id` PRIMARY KEY (`supplier_id`),
  CONSTRAINT `uq_stock_suppliers_code` UNIQUE (`code`),
  KEY `idx_stock_suppliers_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE `stock_receipts` (
  `receipt_id` varchar(36) NOT NULL,
  `receipt_code` varchar(50) NOT NULL,
  `supplier_id` varchar(36),
  `destination_location_id` varchar(36) NOT NULL,
  `purchase_reference` varchar(100),
  `invoice_reference` varchar(100),
  `received_at` timestamp NOT NULL,
  `author` varchar(100) NOT NULL,
  `notes` text,
  `created_at` timestamp DEFAULT (now()),
  CONSTRAINT `stock_receipts_receipt_id` PRIMARY KEY (`receipt_id`),
  CONSTRAINT `uq_stock_receipts_code` UNIQUE (`receipt_code`),
  CONSTRAINT `fk_stock_receipts_supplier` FOREIGN KEY (`supplier_id`)
    REFERENCES `stock_suppliers` (`supplier_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_receipts_destination` FOREIGN KEY (`destination_location_id`)
    REFERENCES `stock_locations` (`location_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  KEY `idx_stock_receipts_supplier_date` (`supplier_id`,`received_at`),
  KEY `idx_stock_receipts_location_date` (`destination_location_id`,`received_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE `stock_provenance_lots` (
  `lot_id` varchar(36) NOT NULL,
  `lot_code` varchar(50) NOT NULL,
  `origin_kind` enum('LEGACY_UNKNOWN','RECEIPT','OTHER') NOT NULL,
  `receipt_id` varchar(36),
  `source_reference` varchar(255),
  `is_system` boolean NOT NULL DEFAULT false,
  `notes` text,
  `created_at` timestamp DEFAULT (now()),
  CONSTRAINT `stock_provenance_lots_lot_id` PRIMARY KEY (`lot_id`),
  CONSTRAINT `uq_stock_provenance_lots_code` UNIQUE (`lot_code`),
  CONSTRAINT `fk_stock_provenance_lots_receipt` FOREIGN KEY (`receipt_id`)
    REFERENCES `stock_receipts` (`receipt_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  KEY `idx_stock_provenance_lots_receipt` (`receipt_id`),
  KEY `idx_stock_provenance_lots_origin` (`origin_kind`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE `stock_receipt_items` (
  `receipt_item_id` varchar(36) NOT NULL,
  `receipt_id` varchar(36) NOT NULL,
  `lot_id` varchar(36) NOT NULL,
  `sku` varchar(50) NOT NULL,
  `type` enum('Box','Pack','Loose','Accessory') NOT NULL,
  `pack_size` int NOT NULL DEFAULT 0,
  `quantity` int unsigned NOT NULL,
  `created_at` timestamp DEFAULT (now()),
  CONSTRAINT `stock_receipt_items_receipt_item_id` PRIMARY KEY (`receipt_item_id`),
  CONSTRAINT `uq_stock_receipt_items_lot` UNIQUE (`lot_id`),
  CONSTRAINT `fk_stock_receipt_items_receipt` FOREIGN KEY (`receipt_id`)
    REFERENCES `stock_receipts` (`receipt_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_receipt_items_lot` FOREIGN KEY (`lot_id`)
    REFERENCES `stock_provenance_lots` (`lot_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_receipt_items_sku` FOREIGN KEY (`sku`)
    REFERENCES `skus` (`sku`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  KEY `idx_stock_receipt_items_receipt` (`receipt_id`),
  KEY `idx_stock_receipt_items_identity` (`sku`,`type`,`pack_size`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE `stock_lot_location_balances` (
  `lot_id` varchar(36) NOT NULL,
  `location_id` varchar(36) NOT NULL,
  `sku` varchar(50) NOT NULL,
  `type` enum('Box','Pack','Loose','Accessory') NOT NULL,
  `pack_size` int NOT NULL DEFAULT 0,
  `on_hand_qty` int unsigned NOT NULL DEFAULT 0,
  `reserved_client_qty` int unsigned NOT NULL DEFAULT 0,
  `reserved_event_qty` int unsigned NOT NULL DEFAULT 0,
  `at_event_qty` int unsigned NOT NULL DEFAULT 0,
  `deposit_qty` int unsigned NOT NULL DEFAULT 0,
  `transit_qty` int unsigned NOT NULL DEFAULT 0,
  `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `last_movement_group_id` varchar(36),
  CONSTRAINT `stock_lot_location_balances_pk` PRIMARY KEY (`lot_id`,`location_id`,`sku`,`type`,`pack_size`),
  CONSTRAINT `fk_stock_lot_location_balances_lot` FOREIGN KEY (`lot_id`)
    REFERENCES `stock_provenance_lots` (`lot_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_lot_location_balances_location` FOREIGN KEY (`location_id`)
    REFERENCES `stock_locations` (`location_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_lot_location_balances_sku` FOREIGN KEY (`sku`)
    REFERENCES `skus` (`sku`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  KEY `idx_stock_lot_location_position` (`location_id`,`sku`,`type`,`pack_size`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE `stock_movement_lot_allocations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `group_id` varchar(36) NOT NULL,
  `lot_id` varchar(36) NOT NULL,
  `location_id` varchar(36) NOT NULL,
  `sku` varchar(50) NOT NULL,
  `type` enum('Box','Pack','Loose','Accessory') NOT NULL,
  `pack_size` int NOT NULL DEFAULT 0,
  `balance_field` enum('onHand','reservedClient','reservedEvent','atEvent','deposit','transit') NOT NULL,
  `qty_delta` int NOT NULL,
  `qty_before` int unsigned NOT NULL,
  `qty_after` int unsigned NOT NULL,
  `created_at` timestamp DEFAULT (now()),
  CONSTRAINT `stock_movement_lot_allocations_id` PRIMARY KEY (`id`),
  CONSTRAINT `fk_stock_movement_lot_group` FOREIGN KEY (`group_id`)
    REFERENCES `stock_movement_groups` (`group_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_movement_lot_lot` FOREIGN KEY (`lot_id`)
    REFERENCES `stock_provenance_lots` (`lot_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_movement_lot_location` FOREIGN KEY (`location_id`)
    REFERENCES `stock_locations` (`location_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_movement_lot_sku` FOREIGN KEY (`sku`)
    REFERENCES `skus` (`sku`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  KEY `idx_stock_movement_lot_group` (`group_id`),
  KEY `idx_stock_movement_lot_history` (`lot_id`,`location_id`,`created_at`),
  KEY `idx_stock_movement_lot_identity` (`sku`,`type`,`pack_size`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

INSERT INTO `stock_provenance_lots` (
  `lot_id`, `lot_code`, `origin_kind`, `receipt_id`,
  `source_reference`, `is_system`, `notes`
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'LEGACY_UNKNOWN',
  'LEGACY_UNKNOWN',
  NULL,
  NULL,
  true,
  'Genesis/current stock backfill; supplier, receipt, source reference and receipt date are unknown.'
);
--> statement-breakpoint

INSERT INTO `stock_lot_location_balances` (
  `lot_id`, `location_id`, `sku`, `type`, `pack_size`,
  `on_hand_qty`, `reserved_client_qty`, `reserved_event_qty`,
  `at_event_qty`, `deposit_qty`, `transit_qty`,
  `updated_at`, `last_movement_group_id`
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  `location_id`, `sku`, `type`, `pack_size`,
  `on_hand_qty`, `reserved_client_qty`, `reserved_event_qty`,
  `at_event_qty`, `deposit_qty`, `transit_qty`,
  `updated_at`, `last_movement_group_id`
FROM `stock_location_balances`;
--> statement-breakpoint

CREATE TRIGGER `trg_stock_receipt_items_bi` BEFORE INSERT ON `stock_receipt_items`
FOR EACH ROW
BEGIN
  IF NEW.quantity <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'receipt_item_quantity_must_be_positive';
  END IF;
  IF (NEW.type = 'Pack' AND NEW.pack_size <= 0) OR (NEW.type <> 'Pack' AND NEW.pack_size <> 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pack_size_sentinel_violation';
  END IF;
END
--> statement-breakpoint

CREATE TRIGGER `trg_stock_receipt_items_bu` BEFORE UPDATE ON `stock_receipt_items`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stock_receipt_items_immutable_no_update';
END
--> statement-breakpoint

CREATE TRIGGER `trg_stock_receipt_items_bd` BEFORE DELETE ON `stock_receipt_items`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stock_receipt_items_immutable_no_delete';
END
--> statement-breakpoint

CREATE TRIGGER `trg_stock_lot_location_balances_bi` BEFORE INSERT ON `stock_lot_location_balances`
FOR EACH ROW
BEGIN
  IF (NEW.type = 'Pack' AND NEW.pack_size <= 0) OR (NEW.type <> 'Pack' AND NEW.pack_size <> 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pack_size_sentinel_violation';
  END IF;
  IF NEW.type = 'Loose' AND NEW.transit_qty <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'loose_forbidden_in_transit';
  END IF;
  IF NEW.type = 'Loose' AND (NEW.on_hand_qty + NEW.deposit_qty + NEW.at_event_qty) > 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'loose_max_4_exceeded';
  END IF;
END
--> statement-breakpoint

CREATE TRIGGER `trg_stock_lot_location_balances_bu` BEFORE UPDATE ON `stock_lot_location_balances`
FOR EACH ROW
BEGIN
  IF (NEW.type = 'Pack' AND NEW.pack_size <= 0) OR (NEW.type <> 'Pack' AND NEW.pack_size <> 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pack_size_sentinel_violation';
  END IF;
  IF NEW.type = 'Loose' AND NEW.transit_qty <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'loose_forbidden_in_transit';
  END IF;
  IF NEW.type = 'Loose' AND (NEW.on_hand_qty + NEW.deposit_qty + NEW.at_event_qty) > 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'loose_max_4_exceeded';
  END IF;
END
--> statement-breakpoint

CREATE TRIGGER `trg_stock_movement_lot_allocations_bi` BEFORE INSERT ON `stock_movement_lot_allocations`
FOR EACH ROW
BEGIN
  IF (NEW.type = 'Pack' AND NEW.pack_size <= 0) OR (NEW.type <> 'Pack' AND NEW.pack_size <> 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pack_size_sentinel_violation';
  END IF;
  IF NEW.type = 'Loose' AND NEW.balance_field = 'transit' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'loose_forbidden_in_transit';
  END IF;
  IF NEW.qty_before + NEW.qty_delta <> NEW.qty_after THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'lot_allocation_arithmetic_mismatch';
  END IF;
END
--> statement-breakpoint

CREATE TRIGGER `trg_stock_movement_lot_allocations_bu` BEFORE UPDATE ON `stock_movement_lot_allocations`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stock_movement_lot_allocations_immutable_no_update';
END
--> statement-breakpoint

CREATE TRIGGER `trg_stock_movement_lot_allocations_bd` BEFORE DELETE ON `stock_movement_lot_allocations`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stock_movement_lot_allocations_immutable_no_delete';
END
