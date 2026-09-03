# Architecture & Product Challenge Memo — R0 Audit & Freeze

**Projet :** CitiCigars Admin V2 / Commerce Operating System
**Date :** 3 septembre 2026
**Source auditée :** `Claudel1971/citicigars-shop`
**Branche :** `replit-commerce-os-v2`
**Commit de référence :** `fac67de0031cf11dcb020fc01921a6df32917551`
**Statut :** R0 terminé — revue propriétaire requise — aucun R1 autorisé

---

## 1. Résumé exécutif — les 10 décisions les plus importantes

1. **FREEZE / KEEP Stock Central et Phase 2.** Le ledger append-only, les projections aggregate/location/lot, le writer transactionnel, le FIFO déterministe et les contrôles de réconciliation constituent le meilleur actif technique du système. Ils ne doivent pas être reconstruits.
2. **Le stock n’a qu’une seule vérité transactionnelle.** CRM, achats, UI, agents, imports et futurs canaux doivent appeler les services Stock Central. Aucun stock parallèle, cache autoritatif, table “simplifiée” ou écriture directe n’est acceptable.
3. **Ne pas lancer R1 automatiquement.** Un jalon R0.1 de décisions et fondations est requis avant tout développement fonctionnel : authority matrix, RBAC, événements/outbox, action registry, approvals, audit, restauration et contrats financiers.
4. **Ne pas inventer le Cigar ID.** Le stock reste identifié par `SKU + type + packSize`. Le Cigar ID est une identité catalogue externe, distincte du SKU, dans une famille indiquée par le cahier mais dont la forme exacte doit être confirmée par le propriétaire. `ID_CONVENTIONS.md` est absent du snapshot audité.
5. **Séparer vérité déterministe, intelligence consultative et actions approuvées.** Un LLM ne calcule jamais stock, cash, coût, marge ou disponibilité et ne parle jamais directement à la DB. Il lit des tools déterministes, propose, explique et attend l’autorisation.
6. **Corriger la séquence V2.1.** Les agents ne doivent pas précéder la qualité des données, les permissions, les journaux cash, le coût déterministe, l’observabilité et les mécanismes de compensation. La couche agentique doit commencer en READ-only, puis PROPOSE, puis EXECUTE sous policy gate.
7. **Traiter cash et landed cost comme de nouveaux ledgers déterministes.** Les commandes actuelles ne constituent pas une vérité cash. Les coûts/marges sont volontairement absents ou `NULL`; aucune reconstitution historique ne doit être fabriquée.
8. **Fermer séparément les trois dettes Phase 2.** Transfert générique, bundle/sampler physique et annulation de vente doivent être trois contrats et gates distincts. Les regrouper dans un grand R2 augmente fortement le risque de régression.
9. **La sécurité actuelle bloque un déploiement V2.** Le secret admin partagé, le token base64 sans expiration, certaines routes de mutation non protégées, l’absence de RBAC et la dérive MySQL/PostgreSQL exigent une correction avant toute autonomie ou extension majeure.
10. **Le “step change” ne vient pas d’un chatbot.** Il vient d’un Global Action Center alimenté par événements et exceptions : chaque recommandation montre faits, preuve, confiance, risque, impact, action proposée, approbateur et compensation.

**Décision R0 recommandée :** accepter le freeze du noyau existant et autoriser uniquement un prochain jalon de fondation/clarification. Ne pas autoriser R1 fonctionnel tant que les décisions MUST de ce memo ne sont pas arbitrées.

---

## 2. Contrôle d’entrée et périmètre réellement audité

La V2.1 locale correspond au blob GitHub `22ddca98fa1facad5bd2e9adfa7630a765f4e467` : 85 359 octets, 3 427 lignes physiques (`wc`) et 3 428 lignes logiques avec fin de fichier. Elle contient la Partie 0, les Parties I et II, les sections 1 à 30, X1 à X12 et les addenda.

Ont été inspectés statiquement :

- la V2.1 intégrale ;
- `PHASE2_STOCK_TRACEABILITY_HANDOFF.md` ;
- schémas stock, CRM et sales ;
- migrations MySQL `0000` à `0021`, y compris la réparation de compatibilité charset ;
- writer Stock Central, movement processor, traceability, monitoring ;
- ventes CRM, achats/réceptions, DNA, CMS, auth et routes legacy ;
- tests et rehearsals présents, sans les exécuter ;
- `feature/crm-phase1` uniquement comme référence historique distante, sans merge.

Les fichiers demandés `ID_CONVENTIONS.md`, `CRM_DNA_STOCK_INTEGRATION_HANDOFF.md` et `CRM_DNA_STOCK_INTEGRATION_HANDOFF_ADDENDUM.md` n’existent ni dans le tree courant audité, ni dans les trees inspectés de `staging-crm-dna-integration` et `feature/crm-phase1`. Leur absence est un risque documentaire réel. Le présent memo ne remplace pas ces contrats et n’invente pas leur contenu.

---

## 3. Compréhension de CitiCigars en 16 points

1. CitiCigars n’est pas seulement un catalogue : c’est une activité relationnelle, mobile et opérationnelle où la confiance et la qualité d’exécution comptent autant que le produit.
2. Le Cameroun impose une expérience adaptée aux usages conversationnels, aux contraintes de connectivité et à la faible tolérance à la friction.
3. La croissance recherchée doit dépasser le premier cercle relationnel sans perdre le niveau de service personnalisé.
4. La valeur différenciante vient de cinq vérités combinées : produit/DNA, client/CRM, stock, achats et économie réelle.
5. Un cigare canonique, un produit commercial, un SKU, une identité physique de stock, un lot et un lieu sont des objets différents.
6. La disponibilité commerciale est une dérivation du Stock Central; elle ne peut pas être déduite d’un catalogue statique.
7. La provenance non prouvée reste `LEGACY_UNKNOWN`; elle ne doit jamais être “complétée” par intuition.
8. L’historique est immuable. Une erreur se corrige par contre-écriture ou opération compensatoire.
9. Le DNA est un système evidence-first : proposition, preuve, validation humaine, publication.
10. Le CRM doit devenir une mémoire opérationnelle et une file de prochaines actions, pas seulement une table de contacts.
11. Les achats doivent évoluer de la saisie de PO vers l’intelligence fournisseur, sans laisser un agent engager du cash seul.
12. La finance opérationnelle doit distinguer vente, encaissement, coût, marge, décaissement et créance.
13. Le propriétaire a besoin de comprendre et décider en quelques minutes depuis mobile, sans connaître les codes internes.
14. Les agents doivent augmenter la qualité de décision, non devenir une nouvelle source de vérité.
15. Toute action sensible doit être explicable, approuvable, idempotente et compensable.
16. L’acceptation visuelle du propriétaire reste indépendante des tests techniques.

---

## 4. Forces du système actuel

### 4.1 Stock Central / Phase 2

Le système possède déjà une architecture transactionnelle sérieuse :

- identité exacte `(SKU, type, packSize)` ;
- six buckets de cycle de vie ;
- ledger de mouvements append-only ;
- groupes d’opérations métier et allocations de lots immuables ;
- projections aggregate, par lieu et par lot maintenues dans une transaction ;
- `SELECT ... FOR UPDATE`, ordre de locks stable et rollback atomique ;
- FIFO déterministe privilégiant les réceptions prouvées et plaçant `LEGACY_UNKNOWN` en dernier ;
- réservations séparées du physique ;
- événements, dépôts, retours, pertes et corrections comptées ;
- réception liée à PO, fournisseur, receipt item et lot ;
- vente CRM liée à des mouvements exacts et idempotents ;
- traceability/read models cohérents et monitoring en lecture seule ;
- triggers empêchant les réécritures destructives.

La décision correcte est **KEEP**, avec extensions uniquement via services existants et migrations forward-only.

### 4.2 Discipline anti-fabrication

Le choix de conserver les faits inconnus comme inconnus est excellent. La projection `LEGACY_UNKNOWN`, les champs historiques `NULL`, l’absence volontaire de coûts inventés et le refus des bundles ambigus protègent la confiance.

### 4.3 Tests et preuves

Le dépôt contient une couverture ciblée et des rehearsals MariaDB importants : atomicité, idempotence, concurrence, FIFO, réconciliation, immutabilité, réception partielle, over-receipt, CRM sale-to-stock et monitoring. R0 n’a pas réexécuté ces tests; leurs résultats restent des preuves historiques documentées, non une nouvelle certification.

### 4.4 DNA et recommandations

Le modèle research/evidence/review et les snapshots de recommandation sont une bonne fondation. Le stockage d’une version de moteur, des scores et des événements de recommandation permet une future évaluation sérieuse.

---

## 5. Limites et risques actuels

### 5.1 Sécurité et permissions — critique

- Le contrôle admin repose sur un mot de passe partagé.
- Le token est une représentation base64 réversible, sans expiration ni révocation.
- Le navigateur conserve un booléen/token de session; l’UI n’est pas une frontière de sécurité.
- Plusieurs routes legacy de produits, imports, bulk updates, images et seed apparaissent insuffisamment protégées.
- Les permissions Owner/Admin/Opérateur/Agent n’existent pas comme capacités serveur.
- Les corrections, pertes, PO et actions externes n’ont pas de séparation des rôles.

**Décision :** REFACTOR/NEW avant autonomie ou nouveau module sensible.

### 5.2 Architecture applicative et configuration

- Un grand routeur legacy mélange catalogue public, mutations admin, CMS, seed, bundles et orchestration.
- MySQL est le chemin actif, mais des adaptateurs PostgreSQL/Neon persistent, créant une ambiguïté d’exploitation.
- La configuration client contient des origines de staging/live; le contrat d’environnement doit être centralisé.
- Le chemin MySQL désactive explicitement TLS; ceci doit être clarifié pour tout environnement distant.
- Le CMS écrit un JSON et des médias sur disque local, sans versioning ni garantie de durabilité.
- JS et TS coexistent avec des référentiels statiques dupliqués côté client/shared.

### 5.3 Finance et économie

Les objets suivants n’existent pas comme vérités déterministes complètes :

- journal d’encaissements append-only ;
- journal de décaissements ;
- remboursements/reversals ;
- rapprochement caisse/mobile money/banque ;
- coûts d’achat, devise, FX, fret, droits, taxes ;
- allocations de landed cost aux réceptions/lots ;
- COGS FIFO et marge réelle ;
- engagements cash et conditions fournisseurs.

Les champs coût/marge `NULL` actuels doivent rester `NULL` tant que le moteur économique n’existe pas.

### 5.4 Identité et CRM

- La forme exacte du Cigar ID n’est pas figée dans les sources disponibles.
- Le code contient une doctrine CTCG, tandis que des imports historiques utilisent encore des UUID métier.
- Le CRM dispose de clients, interactions, DNA et followups, mais pas encore d’un modèle complet accounts/leads/opportunities/consent/campaign attribution.
- Les suppressions en cascade de l’historique client doivent être challengées.
- La fusion d’identités clients n’est pas gouvernée.

### 5.5 Dettes Phase 2 explicites

1. transfert générique lieu-à-lieu ;
2. bundle/sampler physique ;
3. reversal compensatoire d’une vente consommant du stock.

Ces dettes ne doivent ni être cachées ni traitées comme simples écrans.

---

## 6. Classification des composants

| Domaine | Classe | Justification | Priorité |
|---|---|---|---|
| Ledger, groupes, allocations | KEEP / FREEZE | Vérité historique append-only | MUST |
| Projections aggregate/location/lot | KEEP / FREEZE | Projections transactionnelles réconciliées | MUST |
| `stock-movement-processor` | KEEP / EXTEND | Règles pures testables; ajouter sans contourner | MUST |
| `storage.stock` | KEEP / FREEZE | Writer transactionnel unique | MUST |
| Traceability et monitoring | KEEP / REFACTOR | Bonne vérité; requêtes/agrégations à industrialiser | SHOULD |
| Achats/réceptions M8 | KEEP / EXTEND | Atomicité solide; manque approbation, coût et écarts | MUST |
| Vente CRM stock-aware | KEEP / EXTEND | Contrat exact; manque reversal | MUST |
| Historique/import legacy | REFACTOR / QUARANTINE | Faits commerciaux possibles, pas vérité stock | MUST |
| CRM foundation | KEEP / EXTEND | Bonne base, modèle opératoire incomplet | SHOULD |
| DNA evidence/review | KEEP / EXTEND | Evidence-first cohérent | SHOULD |
| Référentiels DNA statiques | REFACTOR | Entrées de recherche, jamais disponibilité stock | SHOULD |
| Auth actuelle | REFACTOR / NEW | Insuffisante pour V2 et agents | MUST |
| Routes legacy monolithiques | REFACTOR | Auth et contrats dispersés | MUST |
| Admin UI existante | REBUILD UI progressivement | Conserver les services; repenser l’expérience | SHOULD |
| CMS fichier | REFACTOR / EXTEND | Utile mais non versionné/durable | SHOULD |
| Cash journals | NEW | Nouvelle vérité cash append-only | MUST |
| Landed cost/COGS | NEW | Moteur déterministe requis pour marge | MUST |
| Generic transfer | EXTEND | Nouveau contrat transactionnel autorisé | SHOULD |
| Bundle/sampler | NEW / EXTEND | BOM versionnée + consommation atomique | SHOULD |
| Sale reversal | EXTEND | Contre-écriture liée aux allocations originales | MUST |
| Event/outbox/action registry | NEW | Fondation agentique et intégrations | MUST |
| Owner Copilot/agents | NEW | READ → PROPOSE → approved EXECUTE | SHOULD |

---

## 7. Architecture cible proposée

### 7.1 Quatre couches

1. **Transactional Core**
   - Stock Central ;
   - futurs journaux cash ;
   - coût/COGS déterministe ;
   - CRM et purchasing services validés ;
   - transactions, idempotency et contre-écritures.

2. **Event & Read Model Plane**
   - transactional outbox ;
   - événements versionnés ;
   - projections reconstructibles ;
   - KPI/drill-down ;
   - exception detection ;
   - recherche globale.

3. **Decision & Agent Plane**
   - tools READ déterministes ;
   - jobs durables ;
   - recommandations, preuves et confiance ;
   - simulations/what-if ;
   - aucune mutation directe.

4. **Policy-Gated Action Plane**
   - action registry typé ;
   - permissions et approbations ;
   - dry-run/validators ;
   - exécution idempotente via services ;
   - compensation et audit.

### 7.2 Source-of-truth matrix

| Fait | Source autoritative |
|---|---|
| Stock physique et historique | Stock Central ledger |
| État stock courant | Projections transactionnelles réconciliées |
| Provenance | Receipt/lot evidence ou `LEGACY_UNKNOWN` |
| Disponibilité | Fonction déterministe des buckets |
| Vente | Orders/order items + lien mouvement |
| Cash | Futurs cash journals, pas `orders.amountPaid` seul |
| Coût/marge | Futur moteur landed cost/COGS déterministe |
| DNA publié | Enregistrement validé avec evidence |
| Interactions CRM | Journal d’interactions |
| Recommandation agent | Proposition auditable, jamais fait transactionnel |
| Mémoire agent | Contexte expirant avec provenance, jamais vérité métier |

---

## 8. Agentic & Intelligence — Step Change Opportunities

### Réponse directe

Si CitiCigars était conçu aujourd’hui comme un système réellement agentique, le changement de niveau ne serait pas de “mettre un LLM partout”. Il faudrait transformer chaque fait métier en signal exploitable et chaque action en commande contrôlée. Stock Central resterait intact; l’intelligence vivrait autour de lui.

### 8.1 Fondation MUST

#### Transactional outbox et événements métier

Chaque vente, mouvement, réservation, PO, réception, followup et futur paiement écrit son fait métier et un événement outbox dans la même transaction. L’événement porte :

- `eventId`, type et version ;
- aggregate ID/version ;
- actor, correlation et causation IDs ;
- horodatage métier et enregistrement ;
- hash du payload ;
- références de preuve ;
- classification de sensibilité.

La publication vers une queue est asynchrone, idempotente, rejouable, avec retry, backoff et dead-letter queue. L’absence de broker ne doit jamais invalider le commit Stock Central.

#### Tool / Action Registry

Chaque capacité est un contrat versionné :

- schémas d’entrée/sortie ;
- permission requise ;
- niveau de risque ;
- validator/dry-run ;
- idempotency key ;
- effets autorisés ;
- stratégie de compensation ;
- journalisation obligatoire.

Les tools READ et les actions de mutation sont séparés. Un agent ne reçoit jamais un “outil SQL”.

#### Policy & Approval Engine

Le moteur de policy détermine qui peut approuver quoi selon montant, quantité, marge, type de mouvement, client, fournisseur et canal. L’agent ne peut pas s’auto-approuver. Cycle recommandé :

`PROPOSED → VALIDATED → AWAITING_APPROVAL → APPROVED → EXECUTING → SUCCEEDED | FAILED | COMPENSATED`.

#### Evidence, confidence et audit

Toute recommandation affiche :

- faits utilisés et fraîcheur ;
- source et drill-down ;
- hypothèses ;
- confiance ;
- alternatives ;
- effet attendu ;
- risque ;
- action proposée ;
- rollback/compensation.

La confiance n’est jamais une autorisation.

#### Durable jobs

Recherche DNA, ingestion fournisseur, OCR, matching, génération de brouillon et calculs analytiques longs doivent être des jobs durables avec lease, heartbeat, déduplication, cancellation, retry class, quotas et DLQ. Aucun handler HTTP ne doit posséder un travail long.

### 8.2 Global Action Center

Créer une file transversale, non une collection de dashboards :

- anomalies de réconciliation ;
- réservations déficitaires ;
- transit/PO en retard ;
- réception avec écart ;
- stock dormant et capital immobilisé ;
- opportunités fournisseur expirantes ;
- clients à relancer ;
- créances et cash close ;
- actions agent en attente d’approbation ;
- jobs échoués ou recommandations devenues obsolètes.

Chaque carte répond à : **Pourquoi maintenant ? Sur quelles preuves ? Quel impact ? Que se passe-t-il si je valide ? Comment compenser ?**

### 8.3 Intelligence à forte valeur

#### Inventory & Purchasing Intelligence

- reorder point, safety stock et days-of-cover déterministes ;
- ranking fournisseur par landed cost, fiabilité, délai, MOQ et historique d’écarts ;
- optimisation “cash-constrained buy” ;
- détection de slow movers par capital, pas seulement quantité ;
- suggestions de transfert, jamais exécution autonome.

#### Supplier Opportunity Detection

Ingestion email/WhatsApp/document d’une promotion → extraction avec citations → matching SKU/Cigar Master → simulation économique → proposition d’achat → décision humaine. Aucune création de PO automatique.

#### Receiving Assistant

Mode mobile scan/photo/voix :

- rapprochement PO/ligne/SKU déterministe ;
- quantité attendue vs reçue ;
- dommage, shortage, overage, quarantaine ;
- photo/preuve ;
- proposition de lot/provenance ;
- validation opérateur ;
- appel au service de réception existant.

Le LLM aide à lire; il ne crée pas le stock.

#### CRM Next-Best-Action

Règles déterministes d’abord : followups dus, inactivité, créance, post-événement, retour en stock, affinité DNA et consentement. Le modèle classe et rédige, mais chaque suggestion contient raison, preuve, expiration et disponibilité fraîche.

#### Owner Copilot

Le copilot ne répond qu’avec des tools déterministes et cite chaque chiffre. Il sait dire “donnée insuffisante”. Il produit :

- briefing du matin ;
- décisions demandées ;
- changements depuis hier ;
- cash et engagements ;
- capital à risque ;
- opportunités ;
- explication et drill-down.

### 8.4 Agent memory vs transactional truth

La mémoire agent peut contenir préférences de présentation, résumés, contexte de tâche et historique de décisions avec provenance et expiration. Elle ne remplace jamais :

- ledger stock ;
- cash journal ;
- coûts ;
- interactions CRM ;
- preuves DNA ;
- PO/receipts ;
- décisions d’approbation.

Un vector store est un index de recherche, pas une base comptable.

### 8.5 Model portability et coûts

- interface commune de génération structurée ;
- OpenAI et Anthropic comme adapters, pas dépendances du domaine ;
- timeouts, retries, fallback et circuit breakers ;
- model/version/prompt enregistrés ;
- budgets par agent et action ;
- cache uniquement pour données non transactionnelles ;
- redaction PII et défense prompt-injection ;
- kill switch global et par canal.

### 8.6 WhatsApp/email futurs

Utiliser des adapters de canal autour d’un inbox/outbox commun : consentement, identité, thread, template/version, delivery status, attribution et audit. Les messages sont d’abord des brouillons approuvés. Aucun agent n’envoie massivement sans politique explicite.

---

## 9. Capacités non imaginées ou insuffisamment explicitées

1. **Capital heatmap par lot/lieu/âge** avec drill-down jusqu’au receipt et mouvement.
2. **Cash-constrained purchasing optimizer** : meilleure allocation du cash disponible entre opportunités.
3. **Supplier OTIF + price variance score** : délai, fill-rate, écarts, qualité et economics.
4. **Receiving dock mode** mobile avec photo, voix et preuve d’écart.
5. **Exception bundling** : regrouper les anomalies liées en un seul dossier d’action.
6. **Decision replay** : revoir ce que le système savait au moment d’une décision.
7. **Recommendation expiry** : invalider une recommandation si stock, prix ou consentement change.
8. **Shadow mode agents** : mesurer la qualité sans aucune action réelle.
9. **Cycle-count intelligence** fondée sur risque, valeur et anomalies, non calendrier fixe.
10. **Quote-to-reservation expiry** pour éviter les promesses omnicanales impossibles.
11. **Quality/quarantine state** pour dommages, humidité ou contrôle réception.
12. **Evidence debt register** : mesurer la part du stock/CRM/DNA dont la preuve est faible ou inconnue.

---

## 10. Navigation et expérience proposées

### Navigation principale

- **Aujourd’hui** — briefing, exceptions, approvals, prochaines actions.
- **Vendre** — vente rapide, réservations, commandes, clients.
- **Stock** — Stock Central, Stock 360, lieux, lots, mouvements.
- **Acheter** — opportunités, fournisseurs, PO, réception.
- **Clients** — contacts/accounts, followups, pipeline, segments.
- **Finance** — cash, créances, coûts, marge.
- **DNA & Catalogue** — Cigar Master, preuves, curator, produits/SKU.
- **Contenu & Croissance** — CMS, campagnes, événements, partenariats.
- **Contrôle** — audit, jobs, agents, permissions, qualité des données.

Mobile : cinq actions prioritaires en bas de l’écran, recherche universelle et command palette. Les UUID restent dans les détails techniques, jamais comme information principale.

### Vues 360

Les écrans Customer, Product/Stock, Supplier, Corporate et Event 360 sont des read models fédérés avec liens vers les sources, non de nouvelles tables duplicatives.

---

## 11. Modèles de domaine proposés

### CRM

Conserver customers/interactions/followups/DNA existants, puis étendre par contrats séparés : contacts, accounts, account_contacts, leads, opportunities, activities/tasks, segments, consent/preferences et relationships. Ne pas créer X1 en une migration spéculative.

### Cigar ID / Product / SKU

- Cigar ID : identité canonique catalogue, externe et à confirmer.
- Product : offre commerciale.
- SKU : unité commerciale/logistique.
- Stock identity : `SKU + type + packSize`.
- Lot : provenance physique prouvée ou inconnue explicite.
- Bundle : BOM versionnée, composants exacts, règle de consommation.

La forme exacte du Cigar ID reste un **owner decision**.

### DNA

Préserver evidence/review/approval. Ajouter citations ligne/source/date, conflits, freshness, provenance des modèles, version de stock au moment d’une recommandation et évaluations offline.

### Corporate / Club / Events

Future-proof par IDs stables, rôles, relations, activités et feature flags. Ne pas créer les tables avant validation d’un premier workflow vertical. Les événements doivent réutiliser Stock Central et CRM, non répliquer participants/stock/ventes sans lien.

### CMS

Faire évoluer le JSON actuel vers blocks/version/draft/publish/schedule/audit et stockage durable des assets. Les claims produit/DNA sensibles doivent pointer vers des preuves validées.

---

## 12. Analytics et stratégie de drill-down

Chaque KPI est défini par :

- nom métier ;
- formule déterministe ;
- source autoritative ;
- fenêtre temporelle ;
- fraîcheur ;
- exclusions ;
- niveau de preuve ;
- drill-down jusqu’aux transactions.

Architecture recommandée :

- read models SQL/materialized tables reconstructibles ;
- incremental updates via outbox ;
- pré-agrégations par jour/SKU/lot/client/fournisseur ;
- aucune requête N+1 par écran ;
- invalidation événementielle ;
- badge de fraîcheur ;
- exclusion visible des positions non réconciliées ;
- aucun “chart theater”.

---

## 13. Réponses aux 12 questions de challenge

1. **Frontend à jeter ?** Le shell admin et les écrans legacy peuvent être reconstruits visuellement; les workflows Stock/Purchasing servent de référence fonctionnelle. Ne pas jeter leurs contrats API/services.
2. **Services Phase 2 réutilisables ?** Movement processor, StockStorage, traceability, monitoring, purchasing et manual sale, avec leurs invariants.
3. **Read models manquants ?** Action Center, 360 views, cash/commitment, capital aging, supplier economics, decision/evidence audit.
4. **Dashboard performant ?** Outbox + read models incrémentaux + requêtes bornées + drill-down par identifiants sources.
5. **Cash Journals ?** Ledger append-only séparé lié aux orders, PO, comptes et méthodes; `orders.amountPaid` devient projection/compatibilité.
6. **Landed cost/COGS ?** Coûts attachés aux receipts/lots; adjustments append-only; historique reste inconnu si non prouvé.
7. **Bundle sûr ?** BOM versionnée et snapshotée à la vente; consommation atomique de composants exacts, jamais stock bundle parallèle.
8. **Reversal ?** Opération compensatoire liée aux mouvements/allocations d’origine, permission et motif obligatoires.
9. **PWA/offline ?** Lecture cache avec fraîcheur explicite; drafts locaux possibles; aucune mutation stock offline non validée côté serveur.
10. **Owner Copilot sourcé ?** Tools déterministes, citations, snapshots, refusal si preuve insuffisante, aucune DB directe.
11. **Master Gestion importable ?** Faits commerciaux prouvés et identifiants avec provenance; pas de stock/coût/provenance reconstruits par inférence.
12. **Retrait sans big bang ?** Profiling read-only, mappings, dual-read comparé, shadow reports, réconciliation, cutover par domaine et rollback documenté.

---

## 14. What the current V2.1 specification is missing or should reconsider

### MUST reconsider

1. **Baseline vs cible.** C-06/C-08 et reversal ne sont pas déjà livrés; ils doivent être marqués futures extensions.
2. **Séquence agents.** R6 arrive trop tôt par rapport à qualité, sécurité, cash, coûts et observabilité.
3. **R2 trop large.** Séparer UX des écritures nouvelles et séparer transfer/bundle/reversal.
4. **Master import trop tardif.** Faire tôt un profiling read-only, sans migration ni backfill.
5. **Gates C-01 à C-30.** Les séparer en technique, données, UX, sécurité/ops et owner GO.
6. **Finance insuffisamment spécifiée.** FX, taxes, remboursements, périodes, rapprochement, landed adjustments et historique.
7. **Authority matrix absente.** Pour chaque champ/KPI, préciser owner et source.
8. **Offline/PWA ambigu.** Interdire explicitement les mutations stock offline.
9. **Sécurité opérationnelle.** RTO/RPO, restore rehearsal, retention, incident response, key rotation et access review.
10. **Consentement/PII.** WhatsApp/email, CRM et agents nécessitent finalité, rétention, opt-out et audit.

### SHOULD reconsider

- X1-X12 doivent être des capability contracts approuvés, pas des tables “future-proof” créées à l’avance.
- Le modèle agentique doit être horizontal (events/tools/policies/evidence) avant de créer douze agents verticaux.
- “Provider abstraction” doit couvrir structured outputs, budgets, traces et evals, pas seulement un switch OpenAI/Anthropic.
- Les actions externes ne sont pas réellement rollbackables; il faut parler de compensation/cancellation.
- L’Owner Visual Gate doit inclure des parcours et critères mesurables, pas seulement une appréciation finale.

---

## 15. MUST / SHOULD / COULD / DO NOT

### MUST

- freeze Phase 2 et le writer unique ;
- publier les contrats d’identité manquants ;
- authority matrix et RBAC ;
- protéger toutes les mutations ;
- définir cash/cost/reversal/transfer/bundle ;
- outbox, audit, idempotency, approvals et compensation ;
- backup/restore testé ;
- read-only Master profiling ;
- owner review de ce memo.

### SHOULD

- R1 read-only centré Today/Action Center ;
- refonte mobile des workflows existants ;
- KPI déterministes et drill-down ;
- PO approvals et receiving discrepancies ;
- CRM followup/consent ;
- shadow-mode intelligence.

### COULD

- forecasting et simulations ;
- PWA installable après contrat offline ;
- adapters WhatsApp/email ;
- semantic search sur preuves ;
- cohorts et capital maps avancées.

### DO NOT

- modifier les migrations Phase 2 acceptées ;
- créer une deuxième vérité stock ;
- inventer Cigar ID, coûts ou provenance ;
- écrire en DB depuis frontend/agent ;
- merger `feature/crm-phase1` ;
- modifier `main`, production, WHC ou Render ;
- lancer R1 sans GO propriétaire ;
- automatiser messages, achats, cash ou stock avant policies et evals.

---

## 16. Séquence de build révisée

### R0 — terminé

Audit, freeze, gap register, architecture et décisions proposées.
**Gate :** revue et arbitrages propriétaire.

### R0.1 — Contracts & Control Foundation

Authority matrix, ID decision, RBAC, audit schema, outbox/event contracts, action registry, policy/approval, backup/restore design, Master profiling read-only.
**Gate :** aucun accès agent direct, aucune ambiguïté de vérité, restore plan accepté.

### R1 — Design System & Read-Only Admin Shell

Navigation, recherche, Today/Action Center skeleton alimenté par read models existants.
**Gate :** Owner Visual Acceptance 1.

### R2A — Stock/Purchasing/CRM UX sur contrats existants

Refonte de l’expérience sans nouveau mouvement.
**Gate :** réconciliation et parcours M4-M9.

### R2B — Receiving exceptions et PO approvals

Écarts, pièces justificatives, approval, mobile dock mode.
**Gate :** aucune réception non prouvée.

### R3 — Cash Journals

Encaissements/décaissements/reversals append-only.
**Gate :** rapprochement et balance.

### R4 — Landed Cost & COGS

Costs par receipt/lot, adjustments, FIFO COGS, marge.
**Gate :** fixture économique manuelle.

### R5 — Decision Read Models

Capital, aging, supplier economics, CRM rules, exception engine.
**Gate :** chaque KPI sourcé.

### R6 — CRM Operating System

Accounts/opportunities/consent/followups et 360.
**Gate :** identité, privacy et source contracts.

### R7 — Trois extensions transactionnelles séparées

R7A transfer, R7B reversal, R7C bundles.
**Gate individuel :** atomicité, idempotence, compensation, réconciliation.

### R8 — Agent Foundation puis agents

READ → shadow PROPOSE → approved EXECUTE.
**Gate :** evals, permissions, coûts, audit et kill switch.

### R9 — Migration/PWA/Hardening

Cutover progressif, offline safe, restore, E2E et owner sign-off.
**Gate :** GO production séparé.

---

## 17. Comment “épater” sans sacrifier la vérité

Le produit doit ouvrir chaque journée avec trois zones :

1. **Ce qui a changé** — faits sourcés.
2. **Ce qui mérite une décision** — exceptions et opportunités.
3. **Ce que CitiCigars propose de faire** — actions validables avec impact et compensation.

La démonstration forte n’est pas un grand dashboard. C’est un propriétaire qui voit une opportunité fournisseur, comprend son impact cash et marge, vérifie la preuve, simule l’achat, approuve un PO, suit la réception, voit le lot alimenter Stock Central, puis relie une vente et son encaissement — avec un audit complet et sans qu’aucun LLM n’ait jamais été la source de vérité.

---

## 18. Décisions propriétaire requises

1. Confirmer ou fournir la convention exacte du Cigar ID et le document `ID_CONVENTIONS.md`.
2. Accepter la séquence R0.1 avant R1.
3. Arbitrer la politique de vente reversal, bundle et transfert.
4. Définir politiques cash, FX, taxes, coût et historique inconnu.
5. Valider le modèle de permissions et double approbation.
6. Confirmer le périmètre réel des handoffs CRM/DNA absents.
7. Accepter que les agents commencent en READ/shadow mode.

---

## 19. STOP GATE

R0 est terminé avec une recommandation **CONDITIONAL FREEZE** :

- **GO** pour préserver/documenter le noyau et préparer les contrats R0.1 ;
- **NO GO** pour R1 ou tout build fonctionnel majeur avant revue propriétaire.

Aucune migration, aucun test, aucun build majeur, aucun déploiement et aucune modification de production/WHC/Render/main n’a été effectué pendant R0.
