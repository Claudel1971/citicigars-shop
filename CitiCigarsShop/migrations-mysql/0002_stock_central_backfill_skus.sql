-- Backfill de `skus` depuis les données déjà existantes (products, bundles)
-- AVANT toute activation de FK sur les tables existantes.
--
-- Audit du dump réel WHC du 16/08/2026 : les 7 SKU CTGBDLxxx existent
-- à la fois dans `products` (héritage catalogue) ET dans `bundles`.
-- La classification BUNDLE est prioritaire lorsqu'un SKU existe dans les deux.

INSERT INTO `skus` (`sku`, `kind`, `created_at`)
SELECT `sku`, 'CIGAR', `created_at` FROM `products`;
--> statement-breakpoint

INSERT INTO `skus` (`sku`, `kind`, `created_at`)
SELECT `sku`, 'BUNDLE', `created_at` FROM `bundles`
ON DUPLICATE KEY UPDATE `kind` = 'BUNDLE';
--> statement-breakpoint

DROP PROCEDURE IF EXISTS `_verify_skus_backfill`;
--> statement-breakpoint
CREATE PROCEDURE `_verify_skus_backfill`()
BEGIN
  DECLARE cnt_skus INT;
  DECLARE cnt_expected INT;
  DECLARE cnt_bad_bundle_kind INT;
  DECLARE cnt_bad_cigar_kind INT;

  SELECT COUNT(*) INTO cnt_skus FROM `skus`;
  SELECT COUNT(*) INTO cnt_expected
  FROM (
    SELECT `sku` FROM `products`
    UNION
    SELECT `sku` FROM `bundles`
  ) AS expected_skus;

  SELECT COUNT(*) INTO cnt_bad_bundle_kind
  FROM `bundles` b
  JOIN `skus` s ON s.`sku` = b.`sku`
  WHERE s.`kind` <> 'BUNDLE';

  SELECT COUNT(*) INTO cnt_bad_cigar_kind
  FROM `products` p
  LEFT JOIN `bundles` b ON b.`sku` = p.`sku`
  JOIN `skus` s ON s.`sku` = p.`sku`
  WHERE b.`sku` IS NULL AND s.`kind` <> 'CIGAR';

  IF cnt_skus <> cnt_expected THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'backfill_skus_count_mismatch';
  END IF;
  IF cnt_bad_bundle_kind <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'backfill_skus_bundle_kind_mismatch';
  END IF;
  IF cnt_bad_cigar_kind <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'backfill_skus_cigar_kind_mismatch';
  END IF;
END
--> statement-breakpoint
CALL `_verify_skus_backfill`();
--> statement-breakpoint
DROP PROCEDURE `_verify_skus_backfill`;
