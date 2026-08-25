-- Phase 2 / Milestone 1: physical-location foundation.
-- stock_balances remains the aggregate compatibility projection. The new
-- stock_location_balances projection is maintained by the same application
-- transaction and must reconcile to the aggregate for every stock identity.

CREATE TABLE `stock_locations` (
  `location_id` varchar(36) NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `category` enum('CITI_STORAGE','PARTNER','EVENT','TRANSIT','OTHER') NOT NULL,
  `active` boolean NOT NULL DEFAULT true,
  `is_system` boolean NOT NULL DEFAULT false,
  `notes` text,
  `created_at` timestamp DEFAULT (now()),
  `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `stock_locations_location_id` PRIMARY KEY (`location_id`),
  CONSTRAINT `uq_stock_locations_code` UNIQUE (`code`),
  KEY `idx_stock_locations_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE `stock_location_balances` (
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
  CONSTRAINT `stock_location_balances_pk` PRIMARY KEY (`location_id`,`sku`,`type`,`pack_size`),
  CONSTRAINT `fk_stock_location_balances_location` FOREIGN KEY (`location_id`)
    REFERENCES `stock_locations` (`location_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_location_balances_sku` FOREIGN KEY (`sku`)
    REFERENCES `skus` (`sku`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  KEY `idx_stock_location_balances_identity` (`sku`,`type`,`pack_size`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

-- Exact existing location is not evidenced by the aggregate balance. Preserve
-- the quantity while stating that uncertainty explicitly; never infer Douala.
INSERT INTO `stock_locations` (
  `location_id`, `code`, `name`, `category`, `active`, `is_system`, `notes`
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'LEGACY_UNKNOWN',
  'Legacy / unknown physical location',
  'OTHER',
  true,
  true,
  'Genesis stock backfill; exact physical location was not evidenced at migration time.'
);
--> statement-breakpoint

INSERT INTO `stock_location_balances` (
  `location_id`, `sku`, `type`, `pack_size`,
  `on_hand_qty`, `reserved_client_qty`, `reserved_event_qty`,
  `at_event_qty`, `deposit_qty`, `transit_qty`,
  `updated_at`, `last_movement_group_id`
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  `sku`, `type`, `pack_size`,
  `on_hand_qty`, `reserved_client_qty`, `reserved_event_qty`,
  `at_event_qty`, `deposit_qty`, `transit_qty`,
  `updated_at`, `last_movement_group_id`
FROM `stock_balances`;
--> statement-breakpoint

CREATE TRIGGER `trg_stock_location_balances_bi` BEFORE INSERT ON `stock_location_balances`
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

CREATE TRIGGER `trg_stock_location_balances_bu` BEFORE UPDATE ON `stock_location_balances`
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
