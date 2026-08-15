-- Custom SQL migration : triggers, pas de CHECK.
-- Raison (schéma diff V2, section 2 corrigée) : version MySQL réelle non
-- confirmée (hébergement WHC.ca / cPanel, cf. package-whc.json/DEPLOY_WHC.md
-- dans ce repo) — un CHECK est accepté à la syntaxe mais silencieusement
-- ignoré sur MySQL <8.0.16. Les triggers fonctionnent sur toute version
-- MySQL/MariaDB depuis longtemps, donc portable indépendamment de la
-- version réelle. Les colonnes unsigned (migration 0000) couvrent déjà
-- "jamais de quantité négative" indépendamment de la version.

CREATE TRIGGER `trg_stock_balances_bi` BEFORE INSERT ON `stock_balances`
FOR EACH ROW
BEGIN
  IF (NEW.type = 'Pack' AND NEW.pack_size <= 0) OR (NEW.type <> 'Pack' AND NEW.pack_size <> 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pack_size_sentinel_violation';
  END IF;
  IF NEW.type = 'Loose' AND NEW.transit_qty <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'loose_forbidden_in_transit';
  END IF;
  IF NEW.type = 'Loose' AND (NEW.on_hand_qty + NEW.deposit_qty + NEW.at_event_qty) > 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'loose_max_4_exceeded';
  END IF;
END
--> statement-breakpoint
CREATE TRIGGER `trg_stock_balances_bu` BEFORE UPDATE ON `stock_balances`
FOR EACH ROW
BEGIN
  IF (NEW.type = 'Pack' AND NEW.pack_size <= 0) OR (NEW.type <> 'Pack' AND NEW.pack_size <> 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pack_size_sentinel_violation';
  END IF;
  IF NEW.type = 'Loose' AND NEW.transit_qty <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'loose_forbidden_in_transit';
  END IF;
  IF NEW.type = 'Loose' AND (NEW.on_hand_qty + NEW.deposit_qty + NEW.at_event_qty) > 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'loose_max_4_exceeded';
  END IF;
END
--> statement-breakpoint
CREATE TRIGGER `trg_stock_movements_bi` BEFORE INSERT ON `stock_movements`
FOR EACH ROW
BEGIN
  IF (NEW.type = 'Pack' AND NEW.pack_size <= 0) OR (NEW.type <> 'Pack' AND NEW.pack_size <> 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pack_size_sentinel_violation';
  END IF;
  IF NEW.type = 'Loose' AND NEW.balance_field = 'transit' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'loose_forbidden_in_transit';
  END IF;
END
--> statement-breakpoint
CREATE TRIGGER `trg_bundle_items_bi` BEFORE INSERT ON `bundle_items`
FOR EACH ROW
BEGIN
  DECLARE v_actual_cigar_id VARCHAR(20);
  IF NEW.product_sku IS NULL AND NEW.component_cigar_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'bundle_items_missing_identity';
  END IF;
  IF NEW.product_sku IS NOT NULL AND NEW.component_cigar_id IS NOT NULL THEN
    SELECT cigar_id INTO v_actual_cigar_id FROM products WHERE sku = NEW.product_sku;
    IF v_actual_cigar_id IS NULL OR v_actual_cigar_id <> NEW.component_cigar_id THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'bundle_items_cigar_id_mismatch';
    END IF;
  END IF;
END
--> statement-breakpoint
CREATE TRIGGER `trg_bundle_items_bu` BEFORE UPDATE ON `bundle_items`
FOR EACH ROW
BEGIN
  DECLARE v_actual_cigar_id VARCHAR(20);
  IF NEW.product_sku IS NULL AND NEW.component_cigar_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'bundle_items_missing_identity';
  END IF;
  IF NEW.product_sku IS NOT NULL AND NEW.component_cigar_id IS NOT NULL THEN
    SELECT cigar_id INTO v_actual_cigar_id FROM products WHERE sku = NEW.product_sku;
    IF v_actual_cigar_id IS NULL OR v_actual_cigar_id <> NEW.component_cigar_id THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'bundle_items_cigar_id_mismatch';
    END IF;
  END IF;
END
