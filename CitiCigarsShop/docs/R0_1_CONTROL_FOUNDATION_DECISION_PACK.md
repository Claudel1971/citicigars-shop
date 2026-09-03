# R0.1 — Control Foundation Decision Pack

**Workspace :** CitiCigarsAdmin
**Date :** 2026-09-03
**Nature :** documentation et architecture seulement
**Baseline :** `ARCHITECTURE_PRODUCT_CHALLENGE_MEMO_R0_20260903.md`
**Statut :** R0.1 documenté — STOP avant R1

## 1. Décisions Owner adoptées

1. Le Cigar ID canonique est `CTCGXXXXXX`, sans tiret ni segment `CIG`.
2. Un ID legacy strictement conforme à `CTGXXXXXX` devient `CTCGXXXXXX` en insérant `C` entre `T` et `G`.
3. La transformation ne peut être appliquée qu’après un préflight de collisions, longueurs et références.
4. Les anciens IDs restent des aliases auditables; aucune réécriture aveugle des documents historiques.
5. L’architecture agentique challengée est adoptée.
6. Les agents partagent leur contexte via un **Context & Evidence Fabric** gouverné, jamais via une mémoire globale mutable.
7. Le Supplier Watcher est le premier vertical slice : email fournisseur, puis web, puis opération intégrée dans CitiCigarsAdmin.
8. Stock Central / Phase 2 reste la vérité transactionnelle et conserve ses sémantiques.
9. Les actions sensibles suivent permissions, policy, approbation, exécution idempotente et compensation.
10. Decision Replay fait partie de la fondation initiale.

## 2. Architecture cible adoptée

```text
AUTHORITATIVE DOMAIN SOURCES
Stock Central · Sales · Purchasing · CRM · Cash · Cost · DNA
                         │
                         ▼
CONTEXT & EVIDENCE FABRIC
Fact access · Read models · Evidence · Scoped memory · Freshness
                         │
                         ▼
EVENT BACKBONE + DURABLE ORCHESTRATION
Transactional outbox · Jobs · Retry · DLQ · Human wait states
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
DETERMINISTIC DECISION SERVICES   AGENT RUNTIME
Rules · Scores · Simulations      Extract · Research · Explain · Draft
             └───────────┬───────────┘
                         ▼
CAPABILITY REGISTRY
Read tools · Analysis tools · Proposed actions · Risk metadata
                         │
                         ▼
IDENTITY + POLICY + APPROVAL
RBAC/ABAC · Separation of duties · Expiry · Human approval
                         │
                         ▼
ACTION EXECUTION GATEWAY
Validation · Idempotency · State machine · Compensation
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
DOMAIN SERVICES                CHANNEL ADAPTERS
Stock/Purchasing/CRM/etc.      Email · WhatsApp · Future channels
```

Contrôles transversaux obligatoires :

- evidence et provenance ;
- runtime observability ;
- audit ;
- offline evaluations ;
- privacy et security ;
- model et cost governance ;
- feature flags ;
- kill switches ;
- Decision Replay.

## 3. Principes de contrôle

### Vérité

- Seules les Authoritative Domain Sources portent les faits métier.
- Les read models sont reconstructibles.
- La mémoire agent est contextuelle, sourcée, bornée et expirante.
- Une inférence reste une inférence; elle ne devient pas un fait par répétition.

### Action

- Le registry décrit; l’Execution Gateway exécute.
- Les tools READ sont séparés des actions de mutation.
- Une action sensible n’est exécutable qu’avec policy et approbation valides.
- L’approbation expire si ses inputs matériels changent.
- Les erreurs historiques se corrigent par compensation.

### Agent

- Les règles et calculs déterministes précèdent le LLM.
- L’agent peut rechercher, extraire, synthétiser, comparer, proposer et rédiger.
- L’agent ne calcule pas seul stock, cash, coût, balance ou marge.
- L’agent n’accède jamais directement à la DB.
- L’autonomie progresse de READ à shadow PROPOSE, puis approved EXECUTE.

## 4. Modules de fondation

| Module | Responsabilité |
|---|---|
| Capability Control Center | Créer, versionner, activer/désactiver et permissionner tools/actions/capabilities |
| Context & Evidence Fabric | Fournir contexte sourcé, preuves, fraîcheur et mémoire scoped |
| Event Backbone | Transporter les faits métier immuables |
| Durable Orchestration | Exécuter workflows, retries, waits, replay et DLQ |
| Deterministic Decision Services | Calculer scores, règles, simulations et exceptions |
| Agent Runtime | Extraction, recherche, explication, alternatives et drafts |
| Identity & Access | Identités humaines, agents, services, rôles et capacités |
| Policy & Approval | Risque, seuils, approbations, séparation des rôles |
| Action Execution Gateway | Validation finale, idempotence, exécution et compensation |
| Decision Replay | Reconstruire faits, contexte, versions et décision au temps T |
| Evaluation & Quality Governance | Golden cases, sécurité, qualité, coût et promotion |
| Channel Adapters | Email, WhatsApp et futurs canaux |

## 5. Documents contractuels

- `CAPABILITY_REGISTRY_CONTRACT.md`
- `AUTHORITY_AND_PERMISSIONS_MATRIX.md`
- `CONTEXT_EVIDENCE_AND_DECISION_REPLAY.md`
- `ACTION_AND_DURABLE_WORKFLOW_CONTRACT.md`
- `SUPPLIER_WATCHER_VERTICAL_SLICE.md`
- `AGENT_EVALUATION_QUALITY_GOVERNANCE.md`
- `CIGAR_ID_CTCG_MIGRATION_PREFLIGHT.md`
- `R0_1_BUILD_GATES.md`

## 6. Dettes Phase 2 préservées comme contrats séparés

1. **Generic location transfer**
   - contrat de mouvement typé ;
   - autorisation, référence métier, idempotence et compensation ;
   - aucun ajout dans R0.1.

2. **Physical bundle/sampler consumption**
   - BOM versionnée ;
   - snapshot des composants ;
   - consommation atomique des identités exactes ;
   - aucun stock bundle parallèle.

3. **Compensating sale reversal**
   - référence aux mouvements et allocations d’origine ;
   - contre-écriture append-only ;
   - politiques stock, cash et comptables explicites.

Chaque dette aura son propre design, test gate et Owner approval.

## 7. MUST / SHOULD / COULD / DO NOT

### MUST

- préserver Stock Central et les sources autoritatives ;
- mettre Capability Registry, Identity, Policy, Approval et Execution Gateway avant toute autonomie ;
- rendre evidence/provenance et Decision Replay obligatoires ;
- commencer Supplier Watcher en email READ/shadow ;
- séparer action proposée, approuvée et exécutée ;
- appliquer least privilege et séparation des rôles ;
- évaluer groundedness, tool use, erreurs et prompt injection ;
- effectuer le préflight CTCG avant toute migration.

### SHOULD

- utiliser un Model Gateway portable ;
- invalider contexte et approbations lorsque les faits changent ;
- fournir un Global Action Center ;
- comparer modèles/prompts en shadow ;
- rendre les workflows durables et rejouables dès le premier vertical slice.

### COULD

- ajouter simulations probabilistes et recherche sémantique ;
- comparer plusieurs fournisseurs et scénarios cash ;
- proposer des résumés Owner proactifs ;
- autoriser des actions à faible risque après preuves de qualité.

### DO NOT

- démarrer R1 ;
- créer un module fonctionnel ;
- modifier Stock Central, ses migrations ou ses sémantiques ;
- merger `feature/crm-phase1` ;
- toucher `main`, production, WHC ou Render ;
- donner un accès DB, email-send, PO actif ou stock direct à un agent ;
- créer une mémoire globale mutable ;
- dupliquer une vérité transactionnelle dans le Context Fabric ;
- pousser sans autorisation explicite.

## 8. Décisions Owner encore requises

1. Confirmer que `XXXXXX` signifie exactement six chiffres, y compris les zéros initiaux.
2. Choisir la politique en cas de collision `CTGxxxxxx` / `CTCGxxxxxx`.
3. Nommer les premiers rôles délégués sous Owner/Super Admin.
4. Définir les seuils d’approbation achat et de double approbation.
5. Définir les dossiers/labels email fournisseur autorisés.
6. Définir la rétention des emails, pièces jointes, preuves et données personnelles.
7. Choisir les fournisseurs/modèles autorisés et budgets initiaux.
8. Définir les critères chiffrés de sortie du shadow mode Supplier Watcher.
9. Définir les actions à faible risque éventuellement auto-exécutables à terme.
10. Arbitrer ultérieurement les trois contrats Phase 2 séparés.

## 9. STOP

R0.1 se limite à la documentation et au design de contrôle. Aucun R1, code fonctionnel, migration, test DB, push ou déploiement n’est inclus.
