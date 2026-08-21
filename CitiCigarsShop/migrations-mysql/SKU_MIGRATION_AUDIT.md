# Audit migration SKU legacy (CTG*) → CTCG-*

## 1. Inventaire des références en dur dans le repo

Recherche exhaustive `grep -rl "CTG[A-Z0-9]"` sur tout le code source (hors `node_modules`, `dist`, build artefacts) :

| Fichier | Nature | Risque |
|---|---|---|
| `client/src/components/admin/UpdatePrices.jsx:196` | Exemple de placeholder texte (`"CTGRD0001"`) | Cosmétique — aucun impact fonctionnel |
| `client/src/components/admin/UploadImages.jsx:358,506` | Exemples de nommage de fichier / placeholder | Cosmétique |
| `client/src/components/admin/BundleManager.jsx:531` | Placeholder de formulaire | Cosmétique |
| `client/src/components/admin/ImportExcel.jsx:24` | **`sku.startsWith('CTGBDL')`** — branche la logique bundle/produit selon le préfixe legacy | **Fonctionnel — cassera silencieusement** une fois les SKU en `CTCG-BDL-*` : les imports Excel de bundles ne seraient plus détectés comme bundles |
| `client/src/components/admin/ImportExcel.jsx:227` | Texte de debug avec exemple `CTGCU0001` | Cosmétique |
| `client/src/data/catalogueData.js` (63 occurrences) | **Données de seed complètes** avec anciens SKU | **Dormant mais réel** : utilisé uniquement par `POST /api/seed`, qui a un garde `if (existingProducts.length > 0) return "already seeded"`. Sans effet tant que la table `products` n'est pas vide, mais si jamais un environnement staging/dev est réinitialisé, ce seed réinjecterait les anciens SKU |
| `client/src/data/bundles.js` (5 occurrences) | Idem, données de seed bundles | Idem — dormant |
| `whc-deploy/assets/index-*.js` | Bundle JS de build déjà déployé (fichier compilé, pas source) | Sans objet — sera régénéré au prochain build après correction des sources |

## 2. Références FK réelles au niveau base de données

- `product_images.sku` → FK vers `products.sku`, `ON DELETE CASCADE`, **`ON UPDATE` non spécifié (= `NO ACTION` par défaut MySQL)**
- `bundle_items.product_sku` → FK vers `products.sku`, **`ON UPDATE NO ACTION`**
- `bundle_items.bundle_sku` → FK vers `bundles.sku`, **`ON UPDATE NO ACTION`**

**Test réel effectué sur le clone MariaDB** (pas une simple lecture du schéma) :
1. Un `UPDATE products SET sku = ...` direct sur une ligne référencée par `product_images` échoue avec `ERROR 1451` (contrainte FK), confirmant qu'un renommage SKU naïf est **bloqué** par la base elle-même — pas de risque de corruption silencieuse, mais aucune migration directe possible sans changement préalable.
2. Après ajout de `ON UPDATE CASCADE` sur la contrainte (`ALTER TABLE ... DROP FOREIGN KEY ... ADD CONSTRAINT ... ON UPDATE CASCADE`), le même `UPDATE products.sku` **réussit et propage automatiquement** la nouvelle valeur vers `product_images.sku`. Vérifié par lecture directe après renommage.

## 3. Méthode de migration validée

1. Sauvegarde complète (mysqldump) avant toute opération, y compris sur staging.
2. Dans une migration Drizzle dédiée : modifier les 3 FK ci-dessus pour ajouter `ON UPDATE CASCADE` (`onUpdate: "cascade"` côté schéma Drizzle).
3. Dans une transaction unique : exécuter les `UPDATE products SET sku = <nouveau>` ligne par ligne selon `sku_legacy_to_ctcg.csv`, dans n'importe quel ordre (le CASCADE gère la propagation vers `product_images` et `bundle_items` automatiquement).
4. Vérifier après coup : `SELECT COUNT(*) FROM products WHERE sku LIKE 'CTG%'` doit retourner 0 ; `SELECT COUNT(*) FROM product_images pi LEFT JOIN products p ON pi.sku = p.sku WHERE p.sku IS NULL` doit retourner 0 (aucune référence orpheline) ; idem pour `bundle_items`.
5. Corriger `ImportExcel.jsx:24` (`startsWith('CTGBDL')` → `startsWith('CTCG-BDL')`) dans le même changement, sans quoi l'import Excel de bundles cesse de fonctionner silencieusement après la migration.
6. Remplacer les SKU d'exemple dans `catalogueData.js`/`bundles.js` par des valeurs `CTCG-*` cohérentes, ou — préférable — neutraliser `POST /api/seed` (endpoint de développement, non censé s'exécuter en production où `products` n'est jamais vide) pour éviter toute confusion future.
7. Rejouer la suite de tests d'intégration (`scripts/integration-tests.ts`) après la migration pour confirmer qu'aucune régression CRM/DNA n'est introduite.

## 4. Correction (revue) — le mapping était disponible, pas absent

Une première version de ce rapport concluait à tort que "le mapping réel
complet n'a pas été appliqué... n'a pas été transmis". **C'était une erreur
de ma part** : le mapping complet, exhaustif et vérifié (59 lignes,
`legacy_sku` → `new_sku`, 59/59 marquées `verified_present_in_final_master
= YES`) était déjà présent dans les fichiers fournis, sous
`migrations-mysql/sku_legacy_to_ctcg_mapping.csv` (copié depuis le fichier
source du chantier). Je n'aurais pas dû conclure à une donnée manquante
sans re-vérifier systématiquement tous les fichiers déposés.

**Correction apportée** : `scripts/migrate-sku-legacy-to-ctcg.ts` implémente
la méthode décrite en section 3, en utilisant ce mapping réel (pas des
valeurs de test arbitraires).

**Test complet 59/59, avec contrôle avant/après rigoureux** (pas
seulement un échantillon) :
- Snapshot avant migration : 59 SKU legacy insérés (valeurs réelles du
  mapping), 20 lignes `product_images` enfants, 2 lignes `bundle_items`
  enfants (`product_sku` référençant un SKU legacy), 0 référence orpheline.
- Dry-run : 59/59 trouvés, 0 manquant.
- Exécution réelle : 59/59 renommés.
- Contrôle après migration, indépendant : 0 SKU legacy restant, 59 SKU
  `CTCG-*` présents, 20/20 `product_images` toujours rattachées (0
  orpheline), 2/2 `bundle_items.product_sku` **effectivement propagées**
  vers les nouvelles valeurs `CTCG-*` (vérifié par lecture directe :
  `CTCG-NI-000001`, `CTCG-NI-000003`), 0 orpheline.

La cascade fonctionne donc de bout en bout sur les deux tables enfants
réelles (`product_images` et `bundle_items`), avec le mapping officiel
complet, pas un sous-ensemble.

**Ce qui reste vrai** : cette exécution a eu lieu **uniquement contre le
clone MariaDB local**, jamais contre staging ou production. Le script est
prêt et prouvé avec les vraies valeurs de mapping ; l'exécution contre
staging/production nécessite une connexion à cette base réelle (hors de
portée de cet environnement sandbox) et doit suivre la procédure de
sauvegarde de `migrations-mysql/README.md`.
