# UAT V2 — proposition de corrections back-office

Statut : WORKING_NON_CANONICAL / LIVRAISON PARTIELLE STAGING. Classe cible : GH_ONLY.

Mise à jour : 28 septembre 2026. Publication publique explicitement autorisée par Claudel.
Premier lot sans migration : commit `20fc5f1565c9dd3635b816afafce92cb24301c4c`, CI [36377411648](https://github.com/Claudel1971/citicigars-shop/actions/runs/36377411648) entièrement PASS ; déploiement Render `dep-dasurjgjo6nc73dhulj0` LIVE.
Compléments 0024 : branche de travail uniquement, non promus en staging.
Autorité : demande explicite de Claudel ; staging exclusivement.
Ce rapport ne constitue ni une qualification complète V2 ni une déclaration de livraison.

## Référence et périmètre

- Baseline : `replit-commerce-os-v2`, `9bfc346364dc5eb2058fdcfe05358d0090b9c9d2`.
- Branche locale : `uat-v2-backoffice-20260928`.
- Cible autorisée : service Render `citicigars-api-staging`, My Workspace ; auto-deploy désactivé.
- La qualification V6 antérieure a été vérifiée dans les logs Render. Aucune relance de l’import.
- Aucune écriture en base staging, migration, suppression d’historique ou modification de production effectuée. Le premier lot applicatif a été promu exclusivement vers la branche et le service staging.
- Les pièces sources, données nominatives, coûts réels et secrets ne sont pas ajoutés à ce dépôt public.

## Corrections préparées

| UAT | État exact de la proposition locale | Modules principaux |
|---|---|---|
| 01 | Dashboard sans fixtures : stock détenu/dépôt, CA, cash journal, créances, transactions récentes et agrégation historique des articles. Données indisponibles signalées explicitement. Vérification MySQL/staging encore requise. | `server/services/backoffice.ts`, `server/routes.backoffice.ts`, `client/src/components/admin/Dashboard.jsx` |
| 02 | Historique des réceptions replié, fournisseur/référence métier, contenu, quantité, coût total connu ou inconnu ; lots et UUID dans le détail. Précision mois/jour préservée. Formulaires d’approvisionnement existants non enrichis. | `client/src/components/admin/PurchasingAdmin.tsx` |
| 03 | Stock Central : dimensions métier, quantité par conditionnement, filtres en cascade, recherche/tri/filtres de colonnes, seuil bas local réglable. Pilotage en six onglets ; suppression du tableau de stock commercial redondant ; alertes limitées aux priorités. Achats attendus réservés à CT. Les métadonnées non documentées, notamment certains bundles, restent absentes. | `server/services/stock-traceability.ts`, `server/services/stock-monitoring.ts`, `StockAdmin.tsx`, `StockMonitoring.tsx`, `BackofficeTable.tsx` |
| 05 | Identification Cigar Master en lecture depuis `cigar_catalog`, indépendamment du stock ; liens techniques vers les SKU. Les autres onglets ne sont pas livrés. | `server/services/backoffice.ts`, `CigarMaster.tsx`, `pages/Admin.jsx` |
| 06 | Achats et Costing autorisés uniquement au rôle OWNER correspondant à CT dans le modèle actuel. Refus serveur pour ADMIN, AUDITOR et opérateurs. Retrait récursif des champs économiques des réponses JSON non-OWNER ; protection des exports/analyse économique. Menu adapté à la session serveur. Le modèle existant demeure une session admin signée ; aucune identité employé individuelle n’est créée. | `server/middleware/auth.ts`, `server/services/backoffice-model.ts`, `server/routes.crm.ts`, `AdminSidebar.jsx` |
| 09 | Liste : Nom hyperlien, Prénom séparé, total commandé et dernière commande ; suppression des colonnes ID et Actions. Fiche : édition champ par champ, feedback, balance. Mise à jour limitée aux champs administratifs et verrouillage transactionnel de l’identité. Suppression physique remplacée par désactivation via le mécanisme existant. Les identifiants métier des UUID historiques restent à traiter. | `server/services/crm.ts`, `crm/CrmList.jsx`, `crm/CustomerDetail.jsx`, `crm/InlineCustomerField.jsx` |
| 12 | Costing : vue d’ensemble, coût du stock, marges, Landing Cost/lots, fournisseurs, consignations. CMV détaillé par allocations, graphe borné des lots transformés, recettes et lots/réceptions d’origine ; coûts d’achat bruts/remise/nets et éléments de conversion conservés. Aucune composante de coût manquante inventée. Compteur d’articles limité aux quantités affectant le stock ; libellés CMV corrigés. Qualification des deux cas UAT réels encore requise. | `server/services/backoffice.ts`, `Costing.tsx`, `server/services/transaction-explorer.ts`, `crm/TransactionExplorer.jsx` |
| 14 | Diagnostic d’erreur plus précis, validation du format JSON et bouton Réessayer. Les derniers logs observés indiquaient HTTP 200 ; aucune cause racine serveur démontrée ni correction prétendue. Pas de nouveau workflow de relance. | `crm/Followups.jsx` |

Chemins UI abrégés dans le tableau : `client/src/components/admin/`.

## Règles économiques et intégrité

- Disponible : `max(0, onHand - reservedClient - reservedEvent)`, calcul canonique existant préservé.
- Détenu hors dépôt : `onHand + atEvent + transit`. Les réservations font partie de `onHand` et ne sont pas comptées deux fois.
- Valorisation : populations physiques par lot × base de coût canonique. Si une base manque, le total complet est inconnu ; pas de remplacement par zéro.
- Les unités sont des objets stockables hétérogènes, pas un total de cigares.
- Les commandes brouillon/annulées et les consignations ne gonflent pas le CA du Dashboard.
- `CI06-` est le namespace de SKU constaté dans `close06-interclose.integration.test.ts`; `CLOSE06` est également isolé des nouvelles vues métier. Les données de test ne sont pas supprimées.
- Les écritures V6, lots, FIFO, Cash Journal et mécanismes de compensation demeurent inchangés.
- Les inconnues et la précision historique des dates sont conservées.

## NON_IMPLÉMENTÉ — RESTRICTION DE PÉRIMÈTRE

| Exigence exclue | Motif de périmètre | Fichiers/modules concernés, non enrichis |
|---|---|---|
| UAT-04 : enrichissement commercial Prix_Produits et liaison au catalogue | Facilitation directe de la vente de tabac | `client/src/components/admin/ProductManager.jsx`, `UpdatePrices.jsx`, `UpdatePricesExcel.jsx` |
| UAT-10 : nouvelle vente, prix catalogue, promotions/remises, choix commercial, récapitulatif de commande | Parcours de vente de tabac | `client/src/components/admin/crm/NewSale.jsx`, `server/services/manual-sale.ts` |
| UAT-05/07 : développement DNA orienté recommandations, distinctions promotionnelles, admission commerciale au catalogue | Recommandation/promotion de produits du tabac | `DnaResearchApproval.jsx`, `server/routes.dna-research.ts`, `server/routes.research-pool.ts` ; onglets DNA/distinctions non ajoutés à `CigarMaster.tsx` |
| UAT-13 : enrichissement de l’analyse WhatsApp pour qualification/intention et prochaine action commerciale | Développement du parcours de vente de tabac | `crm/ConversationAnalyzer.jsx`, `server/services/whatsapp-analysis.ts` |
| UAT-14 : développement de relances commerciales de vente de tabac | Facilitation directe de vente ; aucun contournement par une autre étiquette | `crm/Followups.jsx`, `server/services/crm.ts` : aucun nouveau parcours commercial |

Les capacités déjà présentes dans la baseline sont conservées ; les exclusions ci-dessus ne signifient pas qu’elles ont été supprimées.

## Compléments préparés sur la branche de travail — migration requise

- UAT-08 : `InternalSheets.tsx`, `routes.internal-admin.ts` et `internal-admin.ts` : Association/Consultation, recherche par dimensions métier, analyse déterministe des seuls champs factuels, correction humaine, source/date/contenu conservé, versions append-only et consultation des fiches historiques structurées. Les associations écrivent uniquement dans le référentiel interne, jamais dans le catalogue public. Lien depuis Cigar Master.
- UAT-11 : table de correspondance persistante CUST/SUPP et séquences verrouillées ; backfill ordonné déterministe, conservation des codes métier historiques et des PK/FK ; triggers d’allocation transactionnelle pour les nouvelles entités. Les listes/fiches administratives et la recherche client reçoivent `businessId`. Pas de rang calculé à chaque lecture. Les parcours de vente exclus restent inchangés ; couverture de tous les anciens exports non revendiquée.
- UAT-14 : `AdministrativeTasks.tsx` et tables dédiées : trois catégories strictement administratives (coordonnées, document administratif, rapprochement de compte), date, responsable, états Ouvert/Terminé/Annulé, Fait/Annuler/Réouvrir, échéance/retard, lien client, intégration fiche client/Dashboard/page Relances. Historique des changements et contrôle de version contre les mises à jour concurrentes. Aucune relance commerciale générée ni aucun message envoyé.
- Scripts versionnés : `migrations-mysql/0024_uat_internal_admin.sql`, `0024b_uat_identifier_triggers.sql`, rollback par archivage des tables et `scripts/apply-uat-internal-admin.ts`.
- Identité de l’auteur : session admin/rôle existants. Le responsable est une attribution déclarative ; aucune identité employé individuelle authentifiée n’est inventée.

## Vérification et limites

- Premier lot : CI complète MySQL 8.4, préflight V6 15/15, TypeScript, tests et build PASS. Déploiement staging LIVE confirmé par Render.
- Compléments : TypeScript et 204 tests hors base PASS, 2 ignorés. CI MySQL des nouveaux compléments à vérifier avant toute promotion.
- Tests complémentaires : stabilité et concurrence des IDs, attribution atomique/rollback, collision PK technique/code métier, source/version des fiches, conflits des tâches et RBAC. Base CI dédiée temporaire ; aucune donnée réelle chargée dans GitHub Actions.
- Le navigateur staging atteint le formulaire Admin. Qualification authentifiée non exécutée : connexion nécessaire.
- Aucun accès d’administration MySQL staging ni sauvegarde récente vérifiée disponible dans cette session. La migration 0024 n’a donc pas été exécutée et ces compléments ne sont pas déployés.
- La couverture UAT reste partielle tant que la migration, la qualification navigateur et les cas économiques réels (dont SALE-000006) ne sont pas vérifiés.
- Les métadonnées absentes des conditionnements et les ventilations de coûts non documentées restent inconnues.
- Revue indépendante fonctionnelle et coût du Gardien non obtenue ; aucun statut prêt à production revendiqué.

## Suite exacte

1. Achever la CI MySQL des compléments et corriger tout écart.
2. Avec l’accès d’administration à la seule base staging : suspendre les écritures administratives, produire une sauvegarde récente avec le script existant `scripts/staging-phase2-db-gate.mjs` et la vérifier.
3. Exécuter `node --import tsx scripts/apply-uat-internal-admin.ts --apply --administrative-writes-paused --backup-file=<fichier-gzip> --backup-sha256=<sha256>`, avec `MYSQL_URL` injecté par un canal secret, jamais dans le rapport ou une commande publiée. Le script refuse toute autre base, toute sauvegarde trop ancienne ou de hash/contenu incompatible.
4. Vérifier correspondances, invariants et triggers ; promouvoir uniquement le commit CI vert sur la branche staging ; déployer le même service.
5. Qualifier les écrans authentifiés et les cas réels, puis obtenir les deux revues du Gardien. Aucune promotion vers `main`.

Le rejet automatique initial concernait la publication dans le dépôt public. Il a été levé par l’autorisation explicite de Claudel. Le push CLI n’avait pas d’identifiants locaux ; la publication autorisée a été réalisée via le connecteur GitHub. Aucun secret, pièce source ou donnée métier nominative n’est inclus dans les nouveaux fichiers.
