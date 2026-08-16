-- PATCH audit dump réel WHC 16/08/2026
-- Les tables historiques mélangent latin1 (products) et utf8mb4 (bundle_items).
-- Les deux nouvelles colonnes CIGAR_ID sont donc forcées explicitement vers la
-- même collation que cigar_catalog.cigar_id, sinon les FK de 0004 peuvent être
-- impossibles selon la collation par défaut de la DB.

ALTER TABLE `bundle_items` MODIFY COLUMN `product_sku` varchar(50) NULL;
--> statement-breakpoint
ALTER TABLE `products` ADD `cigar_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;
--> statement-breakpoint
ALTER TABLE `products` ADD `cigars_per_box` int NULL;
--> statement-breakpoint
ALTER TABLE `bundle_items` ADD `component_cigar_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;
--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_cigar_id_unique` UNIQUE(`cigar_id`);
--> statement-breakpoint
CREATE INDEX `idx_bundle_items_component_cigar_id` ON `bundle_items` (`component_cigar_id`);
