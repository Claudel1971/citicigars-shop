-- Install AFTER initial sync/backfill and while administrative writes are paused.
-- Each trigger participates in the caller's transaction: no orphan mapping on rollback.
CREATE TRIGGER admin_customer_business_id AFTER INSERT ON customers FOR EACH ROW
BEGIN
 DECLARE n INT;
 DECLARE code VARCHAR(32);
 SELECT next_value INTO n FROM admin_business_sequences WHERE kind='CUST' FOR UPDATE;
 IF n IS NULL OR n>999999 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Customer business sequence unavailable'; END IF;
 SET code=CONCAT('CTCG-CUST-',LPAD(n,6,'0'));
 IF NEW.customer_id REGEXP '^CTCG-CUST-[0-9]{6}$' AND NOT EXISTS(SELECT 1 FROM admin_business_identifiers WHERE business_id=NEW.customer_id) THEN
  SET code=NEW.customer_id;
  SET n=GREATEST(n,CAST(RIGHT(code,6) AS UNSIGNED));
 END IF;
 INSERT INTO admin_business_identifiers(kind,entity_id,business_id) VALUES ('CUST',NEW.customer_id,code);
 UPDATE admin_business_sequences SET next_value=n+1 WHERE kind='CUST';
END;
--> statement-breakpoint
CREATE TRIGGER admin_supplier_business_id AFTER INSERT ON stock_suppliers FOR EACH ROW
BEGIN
 DECLARE n INT;
 DECLARE code VARCHAR(32);
 SELECT next_value INTO n FROM admin_business_sequences WHERE kind='SUPP' FOR UPDATE;
 IF n IS NULL OR n>999999 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Supplier business sequence unavailable'; END IF;
 SET code=CONCAT('CTCG-SUPP-',LPAD(n,6,'0'));
 INSERT INTO admin_business_identifiers(kind,entity_id,business_id) VALUES ('SUPP',NEW.supplier_id,code);
 UPDATE admin_business_sequences SET next_value=n+1 WHERE kind='SUPP';
END;
