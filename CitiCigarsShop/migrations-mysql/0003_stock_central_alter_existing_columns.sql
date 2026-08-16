-- ÉTAPE 4/5 (point 1, audit) : colonnes SEULEMENT sur les tables existantes
-- (products, bundle_items). Volontairement AUCUNE contrainte FK ici — voir
-- 0004 pour les FK, ajoutées en dernier une fois skus backfillée (0002).
ALTER TABLE `bundle_items` MODIFY COLUMN `product_sku` varchar(50);--> statement-breakpoint
ALTER TABLE `products` ADD `cigar_id` varchar(20);--> statement-breakpoint
ALTER TABLE `products` ADD `cigars_per_box` int;--> statement-breakpoint
ALTER TABLE `bundle_items` ADD `component_cigar_id` varchar(20);--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_cigar_id_unique` UNIQUE(`cigar_id`);--> statement-breakpoint
CREATE INDEX `idx_bundle_items_component_cigar_id` ON `bundle_items` (`component_cigar_id`);