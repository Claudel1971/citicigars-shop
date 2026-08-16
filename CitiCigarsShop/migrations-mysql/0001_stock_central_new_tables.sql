-- ÉTAPE 1/5 (point 1, audit) : les 8 nouvelles tables SEULEMENT. Aucune
-- table existante (products/users/product_images/bundles/bundle_items)
-- n'est touchée ici. Les FK de cette étape ne relient que des tables
-- neuves entre elles (aucun risque sur des données déjà existantes).
CREATE TABLE `accessories` (
	`sku` varchar(50) NOT NULL,
	`nom` varchar(255) NOT NULL,
	`marque` varchar(100),
	`description` text,
	`prix_unitaire` int,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accessories_sku` PRIMARY KEY(`sku`)
);
--> statement-breakpoint
CREATE TABLE `cigar_catalog` (
	`cigar_id` varchar(20) NOT NULL,
	`marque` varchar(100) NOT NULL,
	`ligne` varchar(150) NOT NULL,
	`vitole` varchar(150) NOT NULL,
	`format` varchar(100),
	`dimensions` varchar(50),
	`ring_gauge` int,
	`pays` varchar(100),
	`source_ref` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cigar_catalog_cigar_id` PRIMARY KEY(`cigar_id`)
);
--> statement-breakpoint
CREATE TABLE `dna_availability_watch` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lead_id` int NOT NULL,
	`dna_profile_id` varchar(20) NOT NULL,
	`answers_snapshot` json NOT NULL,
	`refinements_snapshot` json NOT NULL,
	`status` enum('ACTIVE','TRIGGERED','CLOSED') NOT NULL DEFAULT 'ACTIVE',
	`created_at` timestamp DEFAULT (now()),
	`triggered_at` timestamp,
	`closed_at` timestamp,
	`first_match_cigar_ids` json,
	`last_evaluated_at` timestamp,
	`last_evaluated_engine_version` varchar(20),
	CONSTRAINT `dna_availability_watch_id` PRIMARY KEY(`id`),
	CONSTRAINT `dna_availability_watch_lead_id_unique` UNIQUE(`lead_id`)
);
--> statement-breakpoint
CREATE TABLE `dna_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`client_request_id` varchar(36) NOT NULL,
	`first_name` varchar(100) NOT NULL,
	`last_name` varchar(100) NOT NULL,
	`country` varchar(100) NOT NULL,
	`city` varchar(100) NOT NULL,
	`whatsapp` varchar(30) NOT NULL,
	`dna_profile_id` varchar(20) NOT NULL,
	`answers_snapshot` json NOT NULL,
	`refinements_snapshot` json NOT NULL,
	`recommendations_shown` json,
	`consent_given` boolean NOT NULL,
	`consent_timestamp` timestamp NOT NULL,
	`captured_at_step` enum('STEP4_WITH_RESULTS','STEP6_ZERO_CASE') NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dna_leads_id` PRIMARY KEY(`id`),
	CONSTRAINT `dna_leads_client_request_id_unique` UNIQUE(`client_request_id`)
);
--> statement-breakpoint
CREATE TABLE `pack_size_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku` varchar(50) NOT NULL,
	`pack_size` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `pack_size_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_pack_size_config_sku_size` UNIQUE(`sku`,`pack_size`)
);
--> statement-breakpoint
CREATE TABLE `skus` (
	`sku` varchar(50) NOT NULL,
	`kind` enum('CIGAR','ACCESSORY','BUNDLE') NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `skus_sku` PRIMARY KEY(`sku`)
);
--> statement-breakpoint
CREATE TABLE `stock_balances` (
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
	CONSTRAINT `stock_balances_sku_type_pack_size_pk` PRIMARY KEY(`sku`,`type`,`pack_size`)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`group_id` varchar(36) NOT NULL,
	`sku` varchar(50) NOT NULL,
	`type` enum('Box','Pack','Loose','Accessory') NOT NULL,
	`pack_size` int NOT NULL DEFAULT 0,
	`balance_field` enum('onHand','reservedClient','reservedEvent','atEvent','deposit','transit') NOT NULL,
	`movement_type` enum('RECEPTION','VENTE','RESERVATION_CLIENT','LIBERATION_RESERVATION_CLIENT','RESERVATION_EVENEMENT','LIBERATION_RESERVATION_EVENEMENT','SORTIE_EVENEMENT','RETOUR_EVENEMENT','CADEAU','ECHANTILLON','PERTE_CASSE','CORRECTION_INVENTAIRE','MISE_EN_DEPOT','RETOUR_DE_DEPOT','OUVERTURE_BOITE','ENTREE_TRANSIT','RECEPTION_TRANSIT','ASSEMBLAGE_COMPOSITE','DESASSEMBLAGE_COMPOSITE') NOT NULL,
	`qty_delta` int NOT NULL,
	`qty_before` int unsigned NOT NULL,
	`qty_after` int unsigned NOT NULL,
	`reference_type` enum('CLIENT','ORDER','EVENT','PARTNER','OTHER'),
	`reference_label` varchar(255),
	`reference_id` varchar(100),
	`motif` text,
	`comment` text,
	`author` varchar(100) NOT NULL,
	`movement_date` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `accessories` ADD CONSTRAINT `accessories_sku_skus_sku_fk` FOREIGN KEY (`sku`) REFERENCES `skus`(`sku`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dna_availability_watch` ADD CONSTRAINT `dna_availability_watch_lead_id_dna_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `dna_leads`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pack_size_config` ADD CONSTRAINT `pack_size_config_sku_skus_sku_fk` FOREIGN KEY (`sku`) REFERENCES `skus`(`sku`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_balances` ADD CONSTRAINT `stock_balances_sku_skus_sku_fk` FOREIGN KEY (`sku`) REFERENCES `skus`(`sku`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_sku_skus_sku_fk` FOREIGN KEY (`sku`) REFERENCES `skus`(`sku`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_cigar_catalog_mlv` ON `cigar_catalog` (`marque`,`ligne`,`vitole`);--> statement-breakpoint
CREATE INDEX `idx_dna_watch_status` ON `dna_availability_watch` (`status`);--> statement-breakpoint
CREATE INDEX `idx_dna_leads_profile` ON `dna_leads` (`dna_profile_id`);--> statement-breakpoint
CREATE INDEX `idx_pack_size_config_sku` ON `pack_size_config` (`sku`);--> statement-breakpoint
CREATE INDEX `idx_stock_movements_history` ON `stock_movements` (`sku`,`type`,`balance_field`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_stock_movements_group` ON `stock_movements` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_stock_movements_type_date` ON `stock_movements` (`movement_type`,`created_at`);