-- Backfill de `skus` depuis les données déjà existantes (products, bundles)
-- AVANT toute activation de FK sur les tables existantes (schéma diff §13,
-- ordre explicite). `accessories` est neuve et vide à ce stade (créée en
-- 0001, jamais encore peuplée par le seed) : rien à en backfiller ici.

INSERT INTO `skus` (`sku`, `kind`, `created_at`)
SELECT `sku`, 'CIGAR', `created_at` FROM `products`;
--> statement-breakpoint

INSERT INTO `skus` (`sku`, `kind`, `created_at`)
SELECT `sku`, 'BUNDLE', `created_at` FROM `bundles`;
--> statement-breakpoint

-- Vérification des comptes (schéma diff §13) : le nombre de lignes dans `skus`
-- doit être exactement `products` + `bundles`. Si ce n'est pas le cas, la
-- division par zéro ci-dessous fait échouer la migration explicitement plutôt
-- que de laisser une table skus incomplète passer inaperçue.
SELECT IF(
  (SELECT COUNT(*) FROM `skus`) = (SELECT COUNT(*) FROM `products`) + (SELECT COUNT(*) FROM `bundles`),
  1,
  1/0
) AS `backfill_skus_count_check`;
