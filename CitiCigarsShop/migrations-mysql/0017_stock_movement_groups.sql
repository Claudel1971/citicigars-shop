-- Phase 2 / Milestone 2: one append-only header per business operation.
-- Existing stock_movements metadata is retained for backward compatibility.

CREATE TABLE `stock_movement_groups` (
  `group_id` varchar(36) NOT NULL,
  `movement_type` enum(
    'RECEPTION','VENTE','RESERVATION_CLIENT','LIBERATION_RESERVATION_CLIENT',
    'RESERVATION_EVENEMENT','LIBERATION_RESERVATION_EVENEMENT',
    'SORTIE_EVENEMENT','RETOUR_EVENEMENT','CADEAU','ECHANTILLON',
    'PERTE_CASSE','CORRECTION_INVENTAIRE','MISE_EN_DEPOT','RETOUR_DE_DEPOT',
    'OUVERTURE_BOITE','ENTREE_TRANSIT','RECEPTION_TRANSIT',
    'ASSEMBLAGE_COMPOSITE','DESASSEMBLAGE_COMPOSITE'
  ) NOT NULL,
  `source_location_id` varchar(36),
  `destination_location_id` varchar(36),
  `reference_type` enum('CLIENT','ORDER','EVENT','PARTNER','OTHER'),
  `reference_label` varchar(255),
  `reference_id` varchar(100),
  `motif` text,
  `comment` text,
  `author` varchar(100) NOT NULL,
  `movement_date` timestamp NULL,
  `created_at` timestamp DEFAULT (now()),
  CONSTRAINT `stock_movement_groups_group_id` PRIMARY KEY (`group_id`),
  CONSTRAINT `uq_stock_movement_groups_group_type` UNIQUE (`group_id`,`movement_type`),
  CONSTRAINT `fk_stock_movement_groups_source` FOREIGN KEY (`source_location_id`)
    REFERENCES `stock_locations` (`location_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_movement_groups_destination` FOREIGN KEY (`destination_location_id`)
    REFERENCES `stock_locations` (`location_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  KEY `idx_stock_movement_groups_source` (`source_location_id`,`created_at`),
  KEY `idx_stock_movement_groups_destination` (`destination_location_id`,`created_at`),
  KEY `idx_stock_movement_groups_type_date` (`movement_type`,`created_at`),
  KEY `idx_stock_movement_groups_reference` (`reference_type`,`reference_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

-- Historical physical endpoints were never recorded. Leave both NULL rather
-- than pretending that the current LEGACY_UNKNOWN position proves history.
-- The earliest detail row is the deterministic source for duplicated metadata.
INSERT INTO `stock_movement_groups` (
  `group_id`, `movement_type`, `source_location_id`, `destination_location_id`,
  `reference_type`, `reference_label`, `reference_id`, `motif`, `comment`,
  `author`, `movement_date`, `created_at`
)
SELECT
  m.`group_id`, m.`movement_type`, NULL, NULL,
  m.`reference_type`, m.`reference_label`, m.`reference_id`, m.`motif`, m.`comment`,
  m.`author`, m.`movement_date`, m.`created_at`
FROM `stock_movements` m
INNER JOIN (
  SELECT `group_id`, MIN(`id`) AS `first_id`
  FROM `stock_movements`
  GROUP BY `group_id`
) first_row ON first_row.`first_id` = m.`id`;
--> statement-breakpoint

ALTER TABLE `stock_movements`
  ADD CONSTRAINT `fk_stock_movements_group_type`
  FOREIGN KEY (`group_id`,`movement_type`)
  REFERENCES `stock_movement_groups` (`group_id`,`movement_type`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
--> statement-breakpoint

CREATE TRIGGER `trg_stock_movement_groups_bu` BEFORE UPDATE ON `stock_movement_groups`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stock_movement_groups_immutable_no_update';
END
--> statement-breakpoint

CREATE TRIGGER `trg_stock_movement_groups_bd` BEFORE DELETE ON `stock_movement_groups`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stock_movement_groups_immutable_no_delete';
END
