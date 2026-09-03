# Current State — après R0

## Source

- Repo : `Claudel1971/citicigars-shop`
- Branche : `replit-commerce-os-v2`
- Snapshot R0 : `fac67de0031cf11dcb020fc01921a6df32917551`
- V2.1 blob : `22ddca98fa1facad5bd2e9adfa7630a765f4e467`

## Statut

- V2.1 intégrale validée localement.
- R0 Audit & Freeze terminé.
- Memo : `docs/ARCHITECTURE_PRODUCT_CHALLENGE_MEMO_R0_20260903.md`.
- Stock Central / Phase 2 : KEEP / FREEZE.
- R1 : non commencé, non autorisé sans revue propriétaire.
- Production/WHC/Render/main : non touchés.
- `feature/crm-phase1` : observée comme référence historique, jamais mergée.

## Capacités existantes confirmées

- ledger et projections stock ;
- locations/lots/provenance ;
- FIFO ;
- réservations, événements, dépôts, corrections ;
- CRM sale-to-stock ;
- purchasing/receiving ;
- traceability et monitoring ;
- CRM/DNA foundation ;
- CMS legacy.

## Bloqueurs avant build fonctionnel

- convention Cigar ID exacte non disponible ;
- handoffs CRM/DNA demandés absents ;
- auth/RBAC insuffisants ;
- cash/cost/reversal/transfer/bundle non figés ;
- backup/restore et authority matrix à formaliser ;
- owner review R0 requise.
