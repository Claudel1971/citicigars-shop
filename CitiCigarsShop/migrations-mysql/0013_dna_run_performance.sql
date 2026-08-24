-- Task 18 - DNA Run persistence + performance foundation
-- 23 aout 2026

-- ------------------------------------------------------------------
-- 1. Completer le referentiel canonique CIGAR_ID.
--    Source maitre : Top 25 normalise v4, feuille DNA.
--    Les references sans vitole commerciale nommee utilisent N/A.
--    Les CIGAR_ID deja existants ne sont jamais ecrases.
-- ------------------------------------------------------------------

INSERT INTO cigar_catalog
  (cigar_id, marque, ligne, vitole, format, dimensions, ring_gauge, pays, source_ref)
VALUES
('CTG000043','Padrón','60th Anniversary','N/A','Perfecto','6½ × 56',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000071','Perdomo','Legacy Nicaraguan Maduro','Epicure','Toro','6 × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000072','Casa Carrillo','Endure','N/A','Toro','6 × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000092','Montecristo','1935 Anniversary Nicaragua','Espeso','Gordo','5½ × 60',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000095','Oliva','Serie V Melanio Maduro','N/A','Torpedo','6½ × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000105','Perdomo','30th Anniversary Sun Grown','Epicure','Toro','6 × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000115','Plasencia','Cosecha 151','La Tradición','Toro','5⅞ × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000116','Perdomo','30th Anniversary Connecticut','N/A','Torpedo','7 × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000117','A.J. Fernandez','Días de Gloria Brazil','N/A','Figurado','6½ × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000118','Davidoff','Maduro','N/A','Toro','6 × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000141','Padrón','Serie 1926 Maduro','No. 48','Gordo','5½ × 60',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000142','Rocky Patel','A.L.R. Second Edition','N/A','Toro','6½ × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000145','Alec Bradley','Prensado','N/A','Torpedo','6⅛ × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000165','Plasencia','Alma Fuerte','Eduardo I','Toro','6¼ × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000166','Davidoff','Year of the Dragon','Double Corona','Churchill','7½ × 50',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000167','A.J. Fernandez','New World Dorado','Robusto','Robusto Gordo','5½ × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000187','Rocky Patel','Sixty','N/A','Gordo','6 × 60',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000190','Oliva','Serie V','N/A','Churchill','7 × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000191','Alec Bradley','Black Market','N/A','Churchill','7 × 50',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000196','Casa Carrillo','Pledge','Apogee','Gordo','6¼ × 58',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000210','Davidoff','Winston Churchill','Limited Edition 2022','Perfecto','5⅞ × 61',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000211','Perdomo','Inmenso Seventy Sun Grown','Churchill Gordo','Giant','7 × 70',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000253','Perdomo','Reserve 10th Anniversary Maduro','Epicure','Toro','6 × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000254','Rocky Patel','Sixty','N/A','Toro','6½ × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000256','Davidoff','Dominicana','N/A','Robusto Gordo','5⅛ × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000257','A.J. Fernandez','New World Connecticut','N/A','Churchill','7 × 50',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000297','Plasencia','Alma Fuerte','Robustus I','Robusto Gordo','5¼ × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000298','Perdomo','Estate Seleccion Vintage Sungrown','Imperio','Toro','6 × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000331','La Aroma de Cuba','Mi Amor','N/A','Churchill','7 × 50',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000343','Alec Bradley','Blind Faith','Gordo','Gordo','6 × 60',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000364','My Father','La Opulencia','N/A','Toro','6 × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000366','Padrón','Family Reserve','No. 44 Natural','Torpedo','6 × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000371','Montecristo','Nicaragua Series','N/A','Robusto Gordo','5 × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000386','Rocky Patel','Grand Reserve','N/A','Toro','6 × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000387','A.J. Fernandez','Enclave Broadleaf','N/A','Churchill','7 × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000390','Perdomo','Habano Bourbon Barrel Aged Sun Grown','Epicure','Toro','6 × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000410','Arturo Fuente','Don Carlos','Eye of the Shark','Belicoso','5¼ × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000411','Padrón','Serie 1926','No. 2','Belicoso','5½ × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000412','Oliva','Serie V','N/A','Belicoso','5 × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000413','Alec Bradley','Tempus Natural','Centuria','Churchill','7 × 49',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000432','Perdomo','Habano Bourbon Barrel Aged Connecticut','Epicure','Toro','6 × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000433','Davidoff','Winston Churchill The Late Hour','N/A','Churchill','7 × 48',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000436','La Flor Dominicana','Andalusian Bull','Salomón','Pyramid','6½ × 64',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000477','Davidoff','Yamasá','Pirámides','Pyramid','6⅛ × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000500','CAO','Flathead','V660 Carb','Gordo','6 × 60',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000535','Perdomo','Double Aged 12 Year Vintage Maduro','Epicure','Double Corona','6 × 56',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000536','Davidoff','Winston Churchill','N/A','Churchill','6⅞ × 47',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000544','Oliva','Serie V Melanio','N/A','Figurado','6½ × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000547','Rocky Patel','Royale','N/A','Toro','6½ × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000567','A.J. Fernandez','New World Oscuro','Gobernador','Toro Grande','6½ × 55',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000569','Rocky Patel','Royale','N/A','Belicoso','6½ × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000570','Perdomo','20th Anniversary Maduro','Epicure','Double Corona','6 × 56',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000592','Davidoff','Nicaragua','N/A','Toro','5½ × 54',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000674','Alec Bradley','Prensado','N/A','Churchill','7 × 48',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000705','La Flor Dominicana','Ligero Cabinet Oscuro Natural','L 500 Cabinet','Gordo','5¾ × 60',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000723','La Aroma de Cuba','Mi Amor','Magnifico','Toro','6 × 52',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000783','Oliva','Serie V','N/A','Torpedo','6 × 56',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000867','Casa Carrillo','Allegiance','Chaperone','Gordo','6¼ × 58',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000872','Horacio','Edicion Especial','10 Aniversario',NULL,'6½ × 64',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000873','Horacio','Edicion Especial','Horacio XL','Gordo','5 × 60',NULL,NULL,'Top25_20260810_v4|DNA'),
('CTG000874','Horacio','Edicion Especial','Horacio XXL','Giant','7 × 70',NULL,NULL,'Top25_20260810_v4|DNA')
ON DUPLICATE KEY UPDATE cigar_id = VALUES(cigar_id);

--> statement-breakpoint

-- ------------------------------------------------------------------
-- 2. Etat de finalisation de la Page 6 sur le DNA Run existant.
-- ------------------------------------------------------------------

ALTER TABLE customer_dna
  ADD COLUMN page6_completed_at timestamp NULL AFTER tested_at;

--> statement-breakpoint

-- ------------------------------------------------------------------
-- 3. Snapshot immuable Bloc 1.
-- ------------------------------------------------------------------

CREATE TABLE customer_dna_recommendations (
  id int NOT NULL AUTO_INCREMENT,
  customer_id varchar(36) NOT NULL,
  dna_id varchar(36) NOT NULL,
  source_request_id varchar(100) NOT NULL,

  cigar_id varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  sku varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,

  rank_position int NOT NULL,
  dna_score decimal(5,1) NOT NULL,
  priority_level int NULL,

  pack_available boolean NOT NULL,
  box_available boolean NOT NULL,

  dna_source_version varchar(100) NULL,
  sourcing_source_version varchar(100) NULL,

  exposed_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  CONSTRAINT uq_dna_recommendation_run_rank
    UNIQUE (source_request_id, rank_position),

  CONSTRAINT uq_dna_recommendation_run_cigar
    UNIQUE (source_request_id, cigar_id),

  CONSTRAINT fk_dna_reco_customer
    FOREIGN KEY (customer_id)
    REFERENCES customers(customer_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_dna_reco_dna
    FOREIGN KEY (dna_id)
    REFERENCES customer_dna(dna_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_dna_reco_cigar
    FOREIGN KEY (cigar_id)
    REFERENCES cigar_catalog(cigar_id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_dna_reco_sku
    FOREIGN KEY (sku)
    REFERENCES skus(sku)
    ON DELETE RESTRICT
);

--> statement-breakpoint

CREATE INDEX idx_dna_recommendation_customer
  ON customer_dna_recommendations(customer_id);

--> statement-breakpoint

CREATE INDEX idx_dna_recommendation_dna
  ON customer_dna_recommendations(dna_id);

--> statement-breakpoint

CREATE INDEX idx_dna_recommendation_cigar
  ON customer_dna_recommendations(cigar_id);

--> statement-breakpoint

-- ------------------------------------------------------------------
-- 4. Journal append-only de performance du Curator.
--    Task 18 cree la structure.
--    Task 19 enregistrera CLICK.
--    Cart / Checkout pourront ensuite enregistrer ADD_TO_CART / PURCHASE.
-- ------------------------------------------------------------------

CREATE TABLE customer_dna_recommendation_events (
  id int NOT NULL AUTO_INCREMENT,
  recommendation_id int NOT NULL,
  customer_id varchar(36) NOT NULL,
  dna_id varchar(36) NOT NULL,

  event_type enum('CLICK','ADD_TO_CART','PURCHASE') NOT NULL,

  sku varchar(50) NULL,
  order_id varchar(100) NULL,
  order_line_id varchar(100) NULL,
  quantity int NULL,

  occurred_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  CONSTRAINT fk_dna_reco_event_recommendation
    FOREIGN KEY (recommendation_id)
    REFERENCES customer_dna_recommendations(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_dna_reco_event_customer
    FOREIGN KEY (customer_id)
    REFERENCES customers(customer_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_dna_reco_event_dna
    FOREIGN KEY (dna_id)
    REFERENCES customer_dna(dna_id)
    ON DELETE CASCADE
);

--> statement-breakpoint

CREATE INDEX idx_dna_reco_event_recommendation
  ON customer_dna_recommendation_events(recommendation_id);

--> statement-breakpoint

CREATE INDEX idx_dna_reco_event_dna
  ON customer_dna_recommendation_events(dna_id);

--> statement-breakpoint

CREATE INDEX idx_dna_reco_event_type
  ON customer_dna_recommendation_events(event_type);
