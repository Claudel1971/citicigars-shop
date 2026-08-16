-- ⚠️ RÉFÉRENCE UNIQUEMENT — NE PAS EXÉCUTER TEL QUEL.
-- Ce fichier représente l'état DÉJÀ RÉEL de la base (products, users,
-- product_images, bundles, bundle_items existent déjà en production).
-- Il sert uniquement à donner à drizzle-kit un point de départ pour calculer
-- le diff incrémental des migrations 0001+ (point 1, audit). Avant toute
-- application réelle de 0001+, cette migration 0000 doit être marquée comme
-- déjà appliquée (baseline) SANS exécuter son SQL — sinon CREATE TABLE
-- échouera sur des tables déjà existantes.
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
	CONSTRAINT `products_sku` PRIMARY KEY(`sku`)
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
	`product_sku` varchar(50) NOT NULL,
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
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_sku_products_sku_fk` FOREIGN KEY (`sku`) REFERENCES `products`(`sku`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_items` ADD CONSTRAINT `bundle_items_bundle_sku_bundles_sku_fk` FOREIGN KEY (`bundle_sku`) REFERENCES `bundles`(`sku`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_items` ADD CONSTRAINT `bundle_items_product_sku_products_sku_fk` FOREIGN KEY (`product_sku`) REFERENCES `products`(`sku`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_bundle` ON `bundle_items` (`bundle_sku`);--> statement-breakpoint
CREATE INDEX `idx_product` ON `bundle_items` (`product_sku`);--> statement-breakpoint
CREATE INDEX `idx_availability` ON `bundles` (`availability_status`);--> statement-breakpoint
CREATE INDEX `idx_catalogue` ON `bundles` (`in_catalogue`);