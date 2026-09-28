# UAT V2 — proposition de corrections back-office

Statut : WORKING_NON_CANONICAL / NON_DÉPLOYÉ. Classe cible : GH_ONLY.
Autorité : demande explicite de Claudel ; staging exclusivement.
Ce rapport ne constitue ni une qualification complète V2 ni une déclaration de livraison.

## Référence et périmètre

- Baseline : `replit-commerce-os-v2`, `9bfc346364dc5eb2058fdcfe05358d0090b9c9d2`.
- Branche locale : `uat-v2-backoffice-20260928`.
- Cible autorisée : service Render `citicigars-api-staging`, My Workspace ; auto-deploy désactivé.
- La qualification V6 antérieure a été vérifiée dans les logs Render. Aucune relance de l’import.
- Aucune écriture en base, migration, suppression d’historique, promotion ou modification de production effectuée.
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

## Travail autorisé restant — ne pas confondre avec les exclusions

- UAT-08 : association/consultation interne des fiches techniques par CigarID, source/date et lien depuis le référentiel : non réalisée.
- UAT-11 : attribution persistante, déterministe et unique des IDs CUST/SUPP sans modification des PK/FK : non réalisée ; nécessite une migration versionnée et sa vérification. Aucun identifiant calculé par rang instable n’a été substitué.
- UAT-09 : couverture complète des IDs métier dans fiches, menus, exports et recherche dépend d’UAT-11. Vérification réelle de toutes les identités importées encore requise ; aucun découpage arbitraire des noms existants.
- UAT-14 : clarification/couverture des seules tâches administratives, responsable et intégration au Dashboard/fiche client : non réalisée. L’erreur UAT initiale n’a pas été reproduite.
- UAT-03/12 : vérifier en staging les métadonnées de tous les conditionnements et la lisibilité complète de la provenance des deux cas UAT.
- Revue indépendante fonctionnelle et coût du Gardien : non obtenue ; aucun statut prêt à production revendiqué.

## Vérification et blocage

- TypeScript : PASS local.
- Tests hors base : 199 PASS, 2 ignorés ; les tests d’intégration MySQL sont exclus de ce résultat.
- Préflight V6 de la baseline : 15/15 PASS.
- Build local : PASS via `node --import tsx script/build.ts` ; le lanceur `tsx` CLI rencontre une erreur IPC EPERM dans cet environnement. Aucun problème de compilation du bundle observé.
- Tests ajoutés : refus économiques par rôle, absence de lecture de données avant autorisation, non-substitution des coûts inconnus, SQL de lecture à exécuter sur MySQL CI.
- Tests MySQL, non-régression complète, navigateur staging, déploiement et qualification : NON EXÉCUTÉS.
- Le push GitHub a été rejeté par la revue automatique : publication de code potentiellement sensible dans un dépôt public, autorisation explicite jugée manquante. Aucune autre voie de publication n’a été utilisée pour contourner ce rejet.
- La branche reste locale. Autorisation nécessaire pour publier le code de cette proposition dans `Claudel1971/citicigars-shop` PUBLIC, puis poursuivre la CI et les travaux restants.

Après autorisation : vérifier l’absence de changement concurrent, publier la branche isolée, exécuter MySQL/CLOSE-06, résoudre les écarts, poursuivre les UAT autorisées restantes, puis seulement promouvoir sur la branche de staging et déployer la cible vérifiée. Aucune promotion vers `main`.
