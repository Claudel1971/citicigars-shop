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

-- P0.2 (audit) : le SELECT IF(...,1,1/0) précédent ne fait PAS réellement
-- échouer la migration (1/0 renvoie NULL + un warning en MySQL/MariaDB, pas
-- une erreur, y compris en sql_mode strict pour un simple SELECT). Remplacé
-- par une procédure stockée temporaire qui SIGNAL une vraie erreur SQLSTATE
-- 45000 si le compte ne correspond pas — testé par exécution réelle contre
-- une instance MariaDB jetable (voir commit) : provoque un vrai abort.
DROP PROCEDURE IF EXISTS `_verify_skus_backfill`;
--> statement-breakpoint
CREATE PROCEDURE `_verify_skus_backfill`()
BEGIN
  DECLARE cnt_skus INT;
  DECLARE cnt_expected INT;
  SELECT COUNT(*) INTO cnt_skus FROM `skus`;
  SELECT (SELECT COUNT(*) FROM `products`) + (SELECT COUNT(*) FROM `bundles`) INTO cnt_expected;
  IF cnt_skus <> cnt_expected THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'backfill_skus_count_mismatch';
  END IF;
END
--> statement-breakpoint
CALL `_verify_skus_backfill`();
--> statement-breakpoint
DROP PROCEDURE `_verify_skus_backfill`;
