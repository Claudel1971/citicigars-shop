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
CREATE TABLE `product_images` (
	`id` varchar(36) NOT NULL,
	`sku` varchar(50) NOT NULL,
	`type` text NOT NULL,
	`data` text,
	`url` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`sku` varchar(50) NOT NULL,
	`cigar_id` varchar(20),
	`cigars_per_box` int,
	`marque` text NOT NULL,
	`ligne` text,
	`pays` text,
	`modele` text,
	`vitole` text,
	`format` text,
	`dimensions` text,
	`dimensions_mm` text,
	`longueur` text,
	`ring_gauge` int,
	`diametre` text,
	`qte_boite` int,
	`quantite_boite` int,
	`quantite_pack` int,
	`type_pack` int,
	`puissance` int,
	`rating` text,
	`top25` boolean DEFAULT false,
	`rank` int,
	`year` int,
	`prix_unitaire` int,
	`prix_boite` int,
	`prix_pack` int,
	`in_catalogue` boolean DEFAULT true,
	`availability_status` varchar(20) DEFAULT 'IN_STOCK',
	`sold_out_at` timestamp,
	`coup_de_coeur` boolean DEFAULT false,
	`type` varchar(50) DEFAULT 'standard',
	`description` text,
	`origine` text,
	`promotions` json,
	`badges` json,
	`composition` json,
	`prix_bundle` int,
	`fiche_technique` json,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_sku` PRIMARY KEY(`sku`),
	CONSTRAINT `products_cigar_id_unique` UNIQUE(`cigar_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`username` varchar(255) NOT NULL,
	`password` text NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `bundle_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundle_sku` varchar(50) NOT NULL,
	`product_sku` varchar(50),
	`component_cigar_id` varchar(20),
	`quantite` int NOT NULL,
	`prix_unitaire` int,
	`marque` varchar(100),
	`modele` varchar(255),
	`rating` varchar(50),
	`top25` varchar(100),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `bundle_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bundles` (
	`sku` varchar(50) NOT NULL,
	`nom` varchar(255) NOT NULL,
	`description` text,
	`prix_bundle` int NOT NULL,
	`prix_suggere` int,
	`image_url` varchar(500),
	`availability_status` varchar(20) DEFAULT 'IN_STOCK',
	`sold_out_at` timestamp,
	`in_catalogue` boolean DEFAULT true,
	`promo_pourcentage` int,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bundles_sku` PRIMARY KEY(`sku`)
);
--> statement-breakpoint
ALTER TABLE `accessories` ADD CONSTRAINT `accessories_sku_skus_sku_fk` FOREIGN KEY (`sku`) REFERENCES `skus`(`sku`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dna_availability_watch` ADD CONSTRAINT `dna_availability_watch_lead_id_dna_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `dna_leads`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pack_size_config` ADD CONSTRAINT `pack_size_config_sku_skus_sku_fk` FOREIGN KEY (`sku`) REFERENCES `skus`(`sku`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_balances` ADD CONSTRAINT `stock_balances_sku_skus_sku_fk` FOREIGN KEY (`sku`) REFERENCES `skus`(`sku`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_sku_skus_sku_fk` FOREIGN KEY (`sku`) REFERENCES `skus`(`sku`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_sku_products_sku_fk` FOREIGN KEY (`sku`) REFERENCES `products`(`sku`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_sku_skus_sku_fk` FOREIGN KEY (`sku`) REFERENCES `skus`(`sku`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_cigar_id_cigar_catalog_cigar_id_fk` FOREIGN KEY (`cigar_id`) REFERENCES `cigar_catalog`(`cigar_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_items` ADD CONSTRAINT `bundle_items_bundle_sku_bundles_sku_fk` FOREIGN KEY (`bundle_sku`) REFERENCES `bundles`(`sku`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_items` ADD CONSTRAINT `bundle_items_product_sku_products_sku_fk` FOREIGN KEY (`product_sku`) REFERENCES `products`(`sku`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_items` ADD CONSTRAINT `bundle_items_component_cigar_id_cigar_catalog_cigar_id_fk` FOREIGN KEY (`component_cigar_id`) REFERENCES `cigar_catalog`(`cigar_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundles` ADD CONSTRAINT `bundles_sku_skus_sku_fk` FOREIGN KEY (`sku`) REFERENCES `skus`(`sku`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_cigar_catalog_mlv` ON `cigar_catalog` (`marque`,`ligne`,`vitole`);--> statement-breakpoint
CREATE INDEX `idx_dna_watch_status` ON `dna_availability_watch` (`status`);--> statement-breakpoint
CREATE INDEX `idx_dna_leads_profile` ON `dna_leads` (`dna_profile_id`);--> statement-breakpoint
CREATE INDEX `idx_pack_size_config_sku` ON `pack_size_config` (`sku`);--> statement-breakpoint
CREATE INDEX `idx_stock_movements_history` ON `stock_movements` (`sku`,`type`,`balance_field`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_stock_movements_group` ON `stock_movements` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_stock_movements_type_date` ON `stock_movements` (`movement_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_bundle` ON `bundle_items` (`bundle_sku`);--> statement-breakpoint
CREATE INDEX `idx_product` ON `bundle_items` (`product_sku`);--> statement-breakpoint
CREATE INDEX `idx_bundle_items_component_cigar_id` ON `bundle_items` (`component_cigar_id`);--> statement-breakpoint
CREATE INDEX `idx_availability` ON `bundles` (`availability_status`);--> statement-breakpoint
CREATE INDEX `idx_catalogue` ON `bundles` (`in_catalogue`);