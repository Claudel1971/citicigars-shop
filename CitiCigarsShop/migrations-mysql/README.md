# Migrations MySQL — CitiCigars

## Contexte

Avant ce chantier, le repo n'avait **aucune migration versionnée** : le schéma
était poussé directement en base via `drizzle-kit push`. Ce dossier introduit
le premier historique de migrations Drizzle réel.

## Architecture retenue (revue de sécurité après un premier essai insuffisant)

Une première version plaçait une migration "baseline" (décrivant les 5 tables
déjà existantes : `products`, `users`, `product_images`, `bundles`,
`bundle_items`) directement dans ce dossier, avec un simple commentaire
"NE JAMAIS EXÉCUTER". **Test réel effectué : ce commentaire ne protège de
rien.** `drizzle-kit migrate` exécute chaque migration listée dans son
journal sans distinguer un commentaire d'une instruction — le test a
provoqué une erreur `Table already exists` en conditions réelles.

**Correction appliquée : la baseline ne fait plus partie du dossier
exécutable du tout.**

- `migrations-mysql/` contient **une seule migration**,
  `0000_crm_sales_phase1.sql`, qui ne crée que les 7 nouvelles tables Phase 1
  (`customers`, `customer_interactions`, `customer_dna`, `crm_followups`,
  `orders`, `order_items`, `order_item_components`). C'est la seule chose que
  `drizzle-kit migrate` peut exécuter.
- `drizzle-baseline-reference/` (hors dossier de migrations, jamais lu par
  `drizzle-kit migrate`) contient uniquement la référence utilisée pour
  calculer le diff au moment de la génération : l'état des 5 tables
  existantes avant Phase 1. Conservé pour traçabilité et pour la génération
  de la Phase 2.

## Validation effectuée (pas seulement une relecture du SQL)

Un serveur MariaDB réel a été installé et démarré pour ce test. Une base
reproduisant fidèlement l'état de production a été créée : les 5 tables
existantes, avec des données (2 produits, 1 utilisateur).

Scénario testé et vérifié :
1. `drizzle-kit migrate` exécuté contre cette base → migration
   `0000_crm_sales_phase1` appliquée avec succès.
2. **Bug réel détecté et corrigé pendant ce test** : le nom de contrainte FK
   auto-généré par Drizzle pour `crm_followups.source_interaction_id`
   dépassait la limite MySQL de 64 caractères
   (`crm_followups_source_interaction_id_customer_interactions_interaction_id_fk`,
   77 caractères) → `ER_TOO_LONG_IDENT`. Corrigé dans `schema.crm.ts` en
   nommant explicitement cette FK (`fk_followups_source_interaction`).
   Tous les autres identifiants générés ont été vérifiés
   programmatiquement (aucun > 64 caractères).
3. Après correction : migration réappliquée depuis une base "production"
   fraîchement réinitialisée → succès complet, 7 nouvelles tables créées.
4. Comparaison stricte `SHOW CREATE TABLE` avant/après sur les 5 tables
   existantes (`products`, `users`, `product_images`, `bundles`,
   `bundle_items`) → **structure strictement identique**, aucune altération.
5. Données préexistantes (2 lignes `products`, 1 ligne `users`) → intactes
   après migration.
6. `drizzle-kit migrate` relancé une deuxième fois sur la base déjà migrée →
   aucune erreur, rien de nouveau appliqué (idempotence confirmée via la
   table de suivi `__drizzle_migrations` que Drizzle crée et gère
   automatiquement).

## Procédure de déploiement (staging puis production)

1. **Sauvegarde préalable obligatoire** de la base cible (mysqldump complet)
   avant toute exécution, même sur staging.
2. `DATABASE_URL=<url staging> npx drizzle-kit migrate --config=drizzle.config.mysql.ts`
3. Vérifier que les 7 nouvelles tables existent et que les tables
   existantes n'ont subi aucune modification.
4. Répéter en production seulement après validation complète sur staging.

Aucune étape manuelle sur `__drizzle_migrations` n'est nécessaire : comme la
migration ne touche plus aux tables existantes, il n'y a plus de baseline à
"marquer comme déjà appliquée" — `drizzle-kit migrate` gère lui-même son
propre suivi dès la première exécution.

## Rollback

Pas de `DROP` automatique fourni. En cas de besoin de retour arrière :
`DROP TABLE` explicite des 7 tables Phase 1 dans l'ordre inverse des FK
(`order_item_components`, `order_items`, `orders`, `crm_followups`,
`customer_dna`, `customer_interactions`, `customers`) — aucune de ces
tables n'est référencée par une table pré-existante, donc leur suppression
est sans risque pour le reste du système.
