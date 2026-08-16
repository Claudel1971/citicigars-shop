-- ÉTAPE 5/5 (point 1, audit) : FK en dernier, UNIQUEMENT maintenant que
-- skus est backfillée (0002) et que les colonnes existent (0003). Ce sont
-- exactement les 4 FK qui relient une table déjà existante à une table neuve.
ALTER TABLE `products` ADD CONSTRAINT `products_sku_skus_sku_fk` FOREIGN KEY (`sku`) REFERENCES `skus`(`sku`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_cigar_id_cigar_catalog_cigar_id_fk` FOREIGN KEY (`cigar_id`) REFERENCES `cigar_catalog`(`cigar_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_items` ADD CONSTRAINT `bundle_items_component_cigar_id_cigar_catalog_cigar_id_fk` FOREIGN KEY (`component_cigar_id`) REFERENCES `cigar_catalog`(`cigar_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundles` ADD CONSTRAINT `bundles_sku_skus_sku_fk` FOREIGN KEY (`sku`) REFERENCES `skus`(`sku`) ON DELETE no action ON UPDATE no action;