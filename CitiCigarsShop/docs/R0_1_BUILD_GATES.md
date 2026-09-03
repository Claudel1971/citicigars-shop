# Revised Build Gates after R0.1

## Gate R0.1 — Documentation & Control Foundation

Requis :

- décisions Owner enregistrées ;
- architecture cible ;
- Capability Registry ;
- authority/RBAC matrix ;
- Context & Evidence envelope ;
- Decision Replay ;
- Action State Machine ;
- durable workflow contract ;
- Supplier Watcher Phase 1 contract ;
- eval governance ;
- CTCG preflight plan ;
- trois dettes Phase 2 séparées.

Sortie : documentation acceptée. Aucun runtime.

## Gate R0.2 — Foundation Implementation

Avant vertical slice :

- identity/service identities ;
- registry versionné ;
- policy/approval ;
- audit append-only ;
- outbox et durable jobs ;
- context/evidence contracts ;
- replay minimal ;
- feature flags et kill switches ;
- contract/security tests.

Interdit : mutation Stock Central ou action externe agent.

## Gate SW-1 — Supplier Watcher Email Shadow

- mailbox scope Owner ;
- read-only ;
- opportunity drafts ;
- evidence coverage ;
- golden/security tests ;
- zéro send/delete/archive ;
- seuils qualité/coût Owner.

## Gate SW-2 — Web Enrichment Shadow

- allowlist ;
- provenance ;
- prompt-injection resistance ;
- conflict handling ;
- aucune identité ou offre contractuelle fabriquée.

## Gate SW-3 — Integrated Assisted Operation

- Product/Supplier/Stock reads ;
- simulations déterministes ;
- PO/message drafts ;
- approvals ;
- aucun PO/send sans policy.

## Gate SW-4 — Controlled Actions

- capabilities individuellement activées ;
- action state machine ;
- approval expiry/revalidation ;
- compensation ;
- Decision Replay ;
- quality gates continus.

## R1 — Design System & Admin Shell

R1 reste séparé et non commencé. Il nécessite :

- acceptation explicite R0.1 ;
- décision de lancement R1 ;
- périmètre UI ;
- Owner Visual Gate.

## Futures Phase 2 contracts

- Transfer Gate ;
- Bundle/BOM Gate ;
- Sale Reversal Gate.

Aucun n’est implicitement couvert par Supplier Watcher ou R1.

## Final safety gate

Production/WHC/Render/main restent interdits jusqu’à instruction explicite, backup/restore, tests, owner visual acceptance et GO production séparé.
