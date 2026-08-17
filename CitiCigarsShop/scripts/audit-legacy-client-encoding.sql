SET NAMES utf8mb4;

SELECT 'products_top_level' AS scope, COUNT(*) AS affected_rows
FROM products
WHERE CONCAT_WS('|', marque, ligne, pays, modele, vitole, format, dimensions,
  dimensions_mm, longueur, diametre, rating, description, origine)
  LIKE '%??%'
   OR CONCAT_WS('|', marque, ligne, pays, modele, vitole, format, dimensions,
  dimensions_mm, longueur, diametre, rating, description, origine)
  LIKE '%�%'
   OR CONCAT_WS('|', marque, ligne, pays, modele, vitole, format, dimensions,
  dimensions_mm, longueur, diametre, rating, description, origine)
  REGEXP 'Ã|Â';

SELECT 'products_fiche_technique' AS scope, COUNT(*) AS affected_rows
FROM products
WHERE CAST(fiche_technique AS CHAR) LIKE '%??%'
   OR CAST(fiche_technique AS CHAR) LIKE '%�%'
   OR CAST(fiche_technique AS CHAR) REGEXP 'Ã|Â';

SELECT 'products_composition' AS scope, COUNT(*) AS affected_rows
FROM products
WHERE CAST(composition AS CHAR) LIKE '%??%'
   OR CAST(composition AS CHAR) LIKE '%�%'
   OR CAST(composition AS CHAR) REGEXP 'Ã|Â';

SELECT 'bundles' AS scope, COUNT(*) AS affected_rows
FROM bundles
WHERE CONCAT_WS('|', nom, description) LIKE '%??%'
   OR CONCAT_WS('|', nom, description) LIKE '%�%'
   OR CONCAT_WS('|', nom, description) REGEXP 'Ã|Â';

SELECT 'bundle_items' AS scope, COUNT(*) AS affected_rows
FROM bundle_items
WHERE CONCAT_WS('|', marque, modele, rating, top25) LIKE '%??%'
   OR CONCAT_WS('|', marque, modele, rating, top25) LIKE '%�%'
   OR CONCAT_WS('|', marque, modele, rating, top25) REGEXP 'Ã|Â';

SELECT 'cigar_catalog' AS scope, COUNT(*) AS affected_rows
FROM cigar_catalog
WHERE CONCAT_WS('|', marque, ligne, vitole, format, dimensions, pays, source_ref) LIKE '%??%'
   OR CONCAT_WS('|', marque, ligne, vitole, format, dimensions, pays, source_ref) LIKE '%�%'
   OR CONCAT_WS('|', marque, ligne, vitole, format, dimensions, pays, source_ref) REGEXP 'Ã|Â';

SELECT 'accessories' AS scope, COUNT(*) AS affected_rows
FROM accessories
WHERE CONCAT_WS('|', nom, marque, description) LIKE '%??%'
   OR CONCAT_WS('|', nom, marque, description) LIKE '%�%'
   OR CONCAT_WS('|', nom, marque, description) REGEXP 'Ã|Â';

SELECT 'product_technical_sheets' AS scope, COUNT(*) AS affected_rows
FROM product_technical_sheets
WHERE CONCAT_WS('|', smoke_type, evolution, origin_country, wrapper, binder, filler,
  wrapper_appearance, construction, cutting, lighting, draw, burn, ash,
  smoke_quality, dominant_notes, secondary_notes, flavor_evolution,
  local_positioning, rating_source, rating_date, tasting_notes) LIKE '%??%'
   OR CONCAT_WS('|', smoke_type, evolution, origin_country, wrapper, binder, filler,
  wrapper_appearance, construction, cutting, lighting, draw, burn, ash,
  smoke_quality, dominant_notes, secondary_notes, flavor_evolution,
  local_positioning, rating_source, rating_date, tasting_notes) LIKE '%�%'
   OR CONCAT_WS('|', smoke_type, evolution, origin_country, wrapper, binder, filler,
  wrapper_appearance, construction, cutting, lighting, draw, burn, ash,
  smoke_quality, dominant_notes, secondary_notes, flavor_evolution,
  local_positioning, rating_source, rating_date, tasting_notes) REGEXP 'Ã|Â';

SELECT sku,
  CONCAT_WS(',',
    IF(marque LIKE '%??%', 'marque', NULL),
    IF(ligne LIKE '%??%', 'ligne', NULL),
    IF(pays LIKE '%??%', 'pays', NULL),
    IF(vitole LIKE '%??%', 'vitole', NULL),
    IF(dimensions LIKE '%??%', 'dimensions', NULL),
    IF(dimensions_mm LIKE '%??%', 'dimensions_mm', NULL),
    IF(longueur LIKE '%??%', 'longueur', NULL),
    IF(CAST(composition AS CHAR) LIKE '%??%', 'composition', NULL),
    IF(CAST(fiche_technique AS CHAR) LIKE '%??%', 'fiche_technique', NULL)
  ) AS affected_fields
FROM products
WHERE CONCAT_WS('|', marque, ligne, pays, vitole, dimensions, dimensions_mm, longueur,
  CAST(composition AS CHAR), CAST(fiche_technique AS CHAR)) LIKE '%??%'
ORDER BY sku;
