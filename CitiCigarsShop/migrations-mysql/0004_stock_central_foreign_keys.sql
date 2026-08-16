-- PATCH audit dump réel WHC 16/08/2026
-- Ne pas ajouter de FK products.sku -> skus.sku ni bundles.sku -> skus.sku.
-- Motif: les deux tables historiques n'ont PAS la même collation de SKU :
--   products.sku = latin1_swedish_ci
--   bundles.sku  = utf8mb4_unicode_ci
-- Un seul skus.sku ne peut pas être compatible avec les deux sans migration
-- invasive des colonnes historiques et de leurs FK dépendantes. Le registre
-- `skus` reste protégé par les FK de toutes les NOUVELLES tables Stock Central,
-- et son backfill/seed garantit la présence des SKU existants.
--
-- Les FK CIGAR_ID restent sûres : 0003 force les deux colonnes existantes en
-- utf8mb4_unicode_ci, identique à cigar_catalog.cigar_id créé par 0001 patché.

ALTER TABLE `products` ADD CONSTRAINT `products_cigar_id_cigar_catalog_cigar_id_fk`
  FOREIGN KEY (`cigar_id`) REFERENCES `cigar_catalog`(`cigar_id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `bundle_items` ADD CONSTRAINT `bundle_items_component_cigar_id_cigar_catalog_cigar_id_fk`
  FOREIGN KEY (`component_cigar_id`) REFERENCES `cigar_catalog`(`cigar_id`) ON DELETE no action ON UPDATE no action;
