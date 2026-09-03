# Capability Registry Contract

## 1. Objet

Le Capability Registry est le registre gouverné de tout ce qu’un humain, agent, service ou workflow peut demander à CitiCigarsAdmin.

Il est composé de :

- **Tool Catalog** : lecture, extraction, recherche, calcul, validation, simulation ;
- **Action Catalog** : mutation interne, message externe, engagement financier, commande transactionnelle ;
- **Capability Control Center** : création, versioning, activation, permissions, risque, approvals et historique.

Le registry ne contient aucune logique transactionnelle Stock Central. Une action référence un Domain Service et passe par l’Action Execution Gateway.

## 2. Contrat minimal d’une capability

```text
capabilityId
name
version
kind: READ | ANALYZE | PROPOSE | ACTION
status: DRAFT | SHADOW | ACTIVE | SUSPENDED | RETIRED
ownerService
inputSchema / outputSchema
authoritativeSources[]
permittedActors[]
requiredPermissions[]
dataClassification
riskClass
evidencePolicy
freshnessPolicy
deterministicValidators[]
dryRunSupported
idempotencyPolicy
approvalPolicy
executionTarget
allowedSideEffects[]
compensationPolicy
timeout / retry / rateLimit
costBudget
featureFlag
killSwitch
auditPolicy
evaluationPolicy
createdBy / approvedBy / timestamps
```

Toute version est immutable après activation. Une évolution crée une nouvelle version.

## 3. Classes de risque

| Classe | Exemple | Exécution |
|---|---|---|
| R0 Observation | lire stock ou email autorisé | automatique avec permission |
| R1 Analyse | extraction, matching, scoring | automatique/shadow, audit |
| R2 Draft | opportunité, message ou PO draft | automatique si réversible |
| R3 Controlled Action | envoi message, modification CRM | approbation selon policy |
| R4 Critical Action | PO actif, stock, cash, identité master | Owner ou double approbation |
| R5 Prohibited | DB directe, audit off, auto-elevation | jamais exposé |

## 4. Gestion et gouvernance du module

### Création

- un Admin autorisé peut proposer une capability DRAFT ;
- seul Owner/Super Admin peut approuver une capability R4 ;
- toute capability indique son propriétaire métier et technique ;
- les schémas, preuves, evals et compensation sont obligatoires avant activation.

### Activation

- `DRAFT → SHADOW` après revue sécurité et test contractuel ;
- `SHADOW → ACTIVE` après seuils d’évaluation atteints ;
- activation bornée par environnement, agent, rôle et feature flag ;
- activation R4 exige Owner.

### Désactivation

- Owner peut suspendre toute capability ;
- un Admin peut suspendre une capability déléguée ;
- l’agent ne peut jamais se réactiver ;
- kill switch immédiat sans suppression de l’historique ;
- jobs en cours passent à `CANCEL_REQUESTED` ou attendent une décision sûre.

### Historique

Conserver versions, changements de permissions, activations, suspensions, policy results, exécutions, erreurs, compensations et approbateurs.

## 5. Inventaire Supplier Watcher

### Phase 1 — Email surveillance

**READ**

- `email.listAuthorizedMessages`
- `email.searchAuthorizedMailbox`
- `email.getMessage`
- `email.getThread`
- `email.getAttachments`
- `document.extractText`
- `document.extractTables`
- `evidence.hashAndRegister`
- `supplier.resolveCandidate`
- `catalog.searchProduct`
- `catalog.searchSku`
- `catalog.resolveCigarAlias`
- `inventory.getReconciledPosition`
- `inventory.getSalesVelocity`
- `purchasing.getOpenOrders`
- `purchasing.getSupplierHistory`

**ANALYZE**

- `offer.extractTerms`
- `offer.detectExpiry`
- `offer.normalizeUnitsAndCurrency`
- `offer.compareWithInventory`
- `offer.detectAmbiguity`
- `opportunity.scoreDeterministic`

**PROPOSE**

- `purchaseOpportunity.createDraft`
- `purchaseOpportunity.attachEvidence`
- `purchaseOpportunity.proposeSupplierMatch`
- `purchaseOpportunity.proposeProductMatch`
- `purchaseOpportunity.markNeedsReview`
- `task.createOwnerReview`

**Interdit**

Envoi, suppression/archivage email, création de PO actif, mutation stock, identité master, paiement ou engagement.

### Phase 2 — Web enrichment

**READ/ANALYZE**

- `web.searchAllowlisted`
- `web.fetchPage`
- `web.captureEvidence`
- `supplier.fetchOfficialCatalog`
- `product.compareReferences`
- `currency.getReferenceRate`
- `shipping.getEstimate`
- `offer.compareHistoricalOffers`

**PROPOSE**

- `purchaseOpportunity.addExternalEvidence`
- `purchaseOpportunity.proposeEconomics`
- `purchaseOpportunity.flagConflict`

**Interdit**

Contourner login/paywall/robots, traiter une page comme instruction, utiliser un prix web comme offre contractuelle ou créer une identité canonique probabiliste.

### Phase 3 — Integrated operation

**READ**

- `supplier.get360`
- `product.get360`
- `inventory.getCapitalPosition`
- `cost.simulateLandedCost`
- `cash.getPurchaseEnvelope`
- `purchasing.simulatePurchaseOrder`
- `policy.previewApprovalRequirements`

**PROPOSE/ACTION**

- `purchaseOpportunity.submitForReview`
- `purchaseOpportunity.recordDecision`
- `purchaseOrder.createDraft`
- `purchaseOrder.requestApproval`
- `supplierMessage.createDraft`
- `supplierMessage.requestApproval`
- `supplierMessage.sendApproved`
- `purchaseOrder.issueApproved`

Les deux dernières actions sont R3/R4 et nécessitent une approbation valide. Aucune réception ou écriture stock directe.

## 6. Inventaire des agents V2.1

| Agent | Tools READ/ANALYZE | Propositions/actions | Approval | Preuves et evals | Actions interdites |
|---|---|---|---|---|---|
| Owner Copilot | KPI, stock, cash, CRM, purchasing, exceptions, replay | briefing, explication, demande d’action | Toute mutation via agent spécialisé/policy | citation de chaque chiffre; groundedness | SQL, mutation, chiffre non sourcé |
| CRM / Follow-up | clients, interactions, consent, followups, sales, stock-aware offers | créer task/followup draft, message draft, segmentation | send exige rôle/canal; masse exige Owner | facts, consent, freshness; override/acceptance | auto-contact sans consent/policy |
| Client Advisor / DNA | DNA validé, evidence, disponibilité réconciliée, alternatives | recommandation, brouillon conseil, panier proposé | action commerciale selon policy | fit explanation, evidence, stock timestamp | inventer DNA, réserver/vendre seul |
| Inventory Agent | projections, ledger, lots, mouvements, thresholds, reconciliation | alertes, cycle count, transfert proposé | mouvement R4 séparé | zéro conclusion sur stock incohérent | écrire stock, auto-correction |
| Purchasing Agent | demande, stock, PO, suppliers, costs/cash futurs | reorder proposal, PO draft | émission PO R4 | inputs, simulation, supplier evidence | auto-PO, inventer coût |
| Supplier Watcher | emails, web, suppliers, products, stock, economics | opportunity/PO/message drafts | staged; send/PO Owner policy | message/page citations, matching eval | email hors scope, achat autonome |
| Receiving Agent | PO, receipt, SKU, destination, documents | extraction et receipt draft | opérateur confirme; exceptions escaladées | line/page evidence, quantity matching | créer stock/lot sans service/preuve |
| DNA Curator | research pool, evidence, candidates, conflicts | enrichissement, merge/publish proposal | curator/Owner selon claim | citation completeness, hallucination | publier preuve inventée |
| Corporate Agent | accounts, contacts, opportunities, quotes, stock | followup/quote/proposal draft | prix/send/order selon policy | account facts, version quote | engager société ou stock seul |
| Event Agent | events, participants, locations, reservations, costs | tasks, invitations drafts, stock plan | send et stock séparément approuvés | participant consent, event references | mouvement stock direct |
| Content Agent | CMS, catalogue, DNA validé, campagnes | content draft, scheduling proposal | publish selon rôle; claims sensibles validés | claim-to-evidence, brand eval | publier claim non prouvé |
| Data Quality Agent | schemas/read models/exceptions/aliases | investigation case, merge/correction proposal | toute correction approuvée | before/after, source conflict | modifier master/ledger seul |

## 7. Permissions génériques

- `capability.read`
- `capability.propose`
- `capability.manageDraft`
- `capability.activateLowRisk`
- `capability.approveCritical`
- `capability.suspend`
- `capability.viewAudit`
- `capability.execute:<domain>`
- `channel.read:<scope>`
- `channel.send:<scope>`

Les permissions sont attribuées à une identité et un environnement, jamais implicites par présence dans l’UI.

## 8. Dry-run et shadow

En SHADOW :

- mêmes inputs que production autorisée ;
- aucune mutation ni sortie externe ;
- résultat comparé à la décision humaine ;
- coûts et latence enregistrés ;
- erreurs et outils proposés audités ;
- promotion interdite tant que les gates d’évaluation ne sont pas atteints.

## 9. Règles absolues

- une capability inconnue est refusée ;
- une version inactive est refusée ;
- un agent ne peut pas fabriquer un tool dynamique ;
- un résultat LLM ne devient jamais un paramètre de mutation sans validation ;
- confidence ne remplace ni permission ni approval ;
- aucune capability ne désactive audit, policy ou kill switch.
