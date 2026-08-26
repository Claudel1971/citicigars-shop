-- Phase 2 / Milestone 8: minimal purchase orders and atomic evidenced receipts.
-- Existing receipts/items remain valid with nullable new links; no history is inferred.

CREATE TABLE `stock_purchase_orders` (
  `purchase_order_id` varchar(36) NOT NULL,
  `purchase_order_code` varchar(50) NOT NULL,
  `client_request_id` varchar(36) NOT NULL,
  `source_row_hash` varchar(64) NOT NULL,
  `supplier_id` varchar(36) NOT NULL,
  `ordered_at` timestamp NOT NULL,
  `expected_at` timestamp NULL,
  `status` enum('DRAFT','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED') NOT NULL DEFAULT 'ORDERED',
  `purchase_reference` varchar(100) NULL,
  `notes` text NULL,
  `created_by` varchar(100) NOT NULL,
  `created_at` timestamp DEFAULT (now()),
  `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `stock_purchase_orders_purchase_order_id` PRIMARY KEY (`purchase_order_id`),
  CONSTRAINT `uq_stock_purchase_orders_code` UNIQUE (`purchase_order_code`),
  CONSTRAINT `uq_stock_purchase_orders_request` UNIQUE (`client_request_id`),
  CONSTRAINT `fk_stock_purchase_orders_supplier` FOREIGN KEY (`supplier_id`)
    REFERENCES `stock_suppliers` (`supplier_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  KEY `idx_stock_purchase_orders_supplier_date` (`supplier_id`,`ordered_at`),
  KEY `idx_stock_purchase_orders_status` (`status`,`ordered_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE `stock_purchase_order_items` (
  `purchase_order_item_id` varchar(36) NOT NULL,
  `purchase_order_id` varchar(36) NOT NULL,
  `sku` varchar(50) NOT NULL,
  `type` enum('Box','Pack','Loose','Accessory') NOT NULL,
  `pack_size` int NOT NULL DEFAULT 0,
  `ordered_quantity` int unsigned NOT NULL,
  `created_at` timestamp DEFAULT (now()),
  CONSTRAINT `stock_purchase_order_items_purchase_order_item_id` PRIMARY KEY (`purchase_order_item_id`),
  CONSTRAINT `fk_stock_purchase_order_items_order` FOREIGN KEY (`purchase_order_id`)
    REFERENCES `stock_purchase_orders` (`purchase_order_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_purchase_order_items_sku` FOREIGN KEY (`sku`)
    REFERENCES `skus` (`sku`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `uq_stock_purchase_order_items_identity` UNIQUE (`purchase_order_id`,`sku`,`type`,`pack_size`),
  KEY `idx_stock_purchase_order_items_order` (`purchase_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

ALTER TABLE `stock_receipts`
  ADD COLUMN `purchase_order_id` varchar(36) NULL AFTER `supplier_id`,
  ADD COLUMN `client_request_id` varchar(36) NULL AFTER `purchase_order_id`,
  ADD COLUMN `source_row_hash` varchar(64) NULL AFTER `client_request_id`,
  ADD CONSTRAINT `fk_stock_receipts_purchase_order` FOREIGN KEY (`purchase_order_id`)
    REFERENCES `stock_purchase_orders` (`purchase_order_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `uq_stock_receipts_request` UNIQUE (`client_request_id`),
  ADD KEY `idx_stock_receipts_purchase_order` (`purchase_order_id`,`received_at`);
--> statement-breakpoint

ALTER TABLE `stock_receipt_items`
  ADD COLUMN `purchase_order_item_id` varchar(36) NULL AFTER `receipt_id`,
  ADD CONSTRAINT `fk_stock_receipt_items_purchase_order_item` FOREIGN KEY (`purchase_order_item_id`)
    REFERENCES `stock_purchase_order_items` (`purchase_order_item_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD KEY `idx_stock_receipt_items_purchase_order_item` (`purchase_order_item_id`);
--> statement-breakpoint

ALTER TABLE `stock_movement_groups`
  MODIFY COLUMN `reference_type` enum('CLIENT','ORDER','RECEIPT','EVENT','PARTNER','OTHER') NULL;
--> statement-breakpoint

ALTER TABLE `stock_movements`
  MODIFY COLUMN `reference_type` enum('CLIENT','ORDER','RECEIPT','EVENT','PARTNER','OTHER') NULL;
--> statement-breakpoint

DROP TRIGGER IF EXISTS `trg_stock_purchase_order_items_bi`;
--> statement-breakpoint
CREATE TRIGGER `trg_stock_purchase_order_items_bi` BEFORE INSERT ON `stock_purchase_order_items`
FOR EACH ROW
BEGIN
  IF NEW.ordered_quantity <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'purchase_order_quantity_must_be_positive';
  END IF;
  IF (NEW.type = 'Pack' AND NEW.pack_size <= 0) OR (NEW.type <> 'Pack' AND NEW.pack_size <> 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pack_size_sentinel_violation';
  END IF;
END
