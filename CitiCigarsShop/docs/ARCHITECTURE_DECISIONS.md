# Architecture Decisions — R0 / R0.1

Statuts : **FROZEN**, **ADOPTED**, **PROPOSED**, **OWNER DECISION REQUIRED**.

## ADR-001 — Stock Central est la vérité stock

**Statut : FROZEN**
Ledger append-only; projections aggregate/location/lot; writer transactionnel unique.

## ADR-002 — Identité physique

**Statut : FROZEN**
`SKU + type + packSize`, complété par lieu/lot pour le physique.

## ADR-003 — Cigar ID

**Statut : ADOPTED**
Format canonique `CTCGXXXXXX`. Les aliases strictement conformes à `CTGXXXXXX` migrent logiquement par insertion de `C`, seulement après préflight collisions/longueurs/références. Alias et historique sont préservés.

## ADR-004 — Correction historique

**Statut : FROZEN**
Contre-écriture/compensation; jamais réécriture silencieuse.

## ADR-005 — Architecture agentique CitiCigarsAdmin

**Statut : ADOPTED**
Authoritative Domain Sources → Context & Evidence Fabric → Event Backbone + Durable Orchestration → Decision Services/Agent Runtime → Capability Registry → Identity/Policy/Approval → Action Execution Gateway → Domain Services/Channel Adapters.

## ADR-006 — Transactional outbox

**Statut : ADOPTED**
Événement écrit avec la transaction métier; publication asynchrone et rejouable.

## ADR-007 — Cash et coût

**Statut : OWNER DECISION REQUIRED**
Nouveaux ledgers déterministes. Aucun backfill historique sans preuve.

## ADR-008 — Offline

**Statut : PROPOSED**
Lectures cache avec fraîcheur; drafts locaux; validation serveur obligatoire pour mutations.

## ADR-009 — Extensions Phase 2

**Statut : ADOPTED**
Generic transfer, compensating sale reversal et physical bundle/sampler via BOM versionnée sont trois contrats et gates séparés.

## ADR-010 — Séquence

**Statut : ADOPTED**
R0.1 contracts/control avant R1; agents après données, permissions, finance et observabilité.

## ADR-011 — Shared Context

**Statut : ADOPTED**
Les agents partagent uniquement un contexte gouverné, sourcé, scoped et expirant via Context & Evidence Fabric. Aucune mémoire globale mutable et aucune duplication de vérité transactionnelle.

## ADR-012 — Capability governance

**Statut : ADOPTED**
Un Capability Control Center gouverne création, version, activation, permissions, risque, approvals, kill switch et historique des tools/actions.

## ADR-013 — Decision Replay

**Statut : ADOPTED**
Chaque décision importante est rejouable avec contexte, preuves, versions, tools, policy, approbations et résultat du temps T.

## ADR-014 — Agent quality

**Statut : ADOPTED**
Golden cases, groundedness, tool accuracy, hallucination/error, overrides, acceptance, sécurité, coût et latence conditionnent toute promotion d’autonomie.

## ADR-015 — Supplier Watcher

**Statut : ADOPTED**
Premier vertical slice en trois phases permissionnées séparément : email surveillance, web enrichment, integrated CitiCigarsAdmin operation.

## ADR-016 — RBAC Owner

**Statut : ADOPTED**
Owner/Super Admin est autorité ultime. Admin gère seulement les rôles délégués et ne peut s’auto-élever, créer un Owner, désactiver audit ou contourner une critical policy sans Owner.
