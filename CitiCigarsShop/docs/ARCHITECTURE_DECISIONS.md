# Architecture Decisions — R0

Statuts : **FROZEN**, **PROPOSED**, **OWNER DECISION REQUIRED**.

## ADR-001 — Stock Central est la vérité stock

**Statut : FROZEN**
Ledger append-only; projections aggregate/location/lot; writer transactionnel unique.

## ADR-002 — Identité physique

**Statut : FROZEN**
`SKU + type + packSize`, complété par lieu/lot pour le physique.

## ADR-003 — Cigar ID

**Statut : OWNER DECISION REQUIRED**
Identité catalogue distincte du SKU. Forme exacte non définie dans les sources disponibles; aucune création ou migration autorisée.

## ADR-004 — Correction historique

**Statut : FROZEN**
Contre-écriture/compensation; jamais réécriture silencieuse.

## ADR-005 — Architecture agentique en trois plans

**Statut : PROPOSED**
Core déterministe, intelligence consultative, actions policy-gated.

## ADR-006 — Transactional outbox

**Statut : PROPOSED**
Événement écrit avec la transaction métier; publication asynchrone et rejouable.

## ADR-007 — Cash et coût

**Statut : OWNER DECISION REQUIRED**
Nouveaux ledgers déterministes. Aucun backfill historique sans preuve.

## ADR-008 — Offline

**Statut : PROPOSED**
Lectures cache avec fraîcheur; drafts locaux; validation serveur obligatoire pour mutations.

## ADR-009 — Extensions Phase 2

**Statut : PROPOSED**
Transfer, reversal et bundle sont trois jalons séparés.

## ADR-010 — Séquence

**Statut : PROPOSED**
R0.1 contracts/control avant R1; agents après données, permissions, finance et observabilité.
