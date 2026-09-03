# Production Cutover Runbook — NOT AUTHORIZED

## Statut

Placeholder de continuité créé pendant R0. Aucun cutover n’est autorisé.

## Conditions minimales futures

- C-01 à C-30 répartis en gates cohérents et passés ;
- migrations répétées sur clone restauré ;
- backup restaurable vérifié ;
- RTO/RPO acceptés ;
- audit sécurité et permissions ;
- réconciliation stock/cash/coût ;
- E2E et rollback/compensation ;
- owner visual sign-off ;
- GO production explicite.

## Interdictions

- aucune commande de déploiement depuis R0 ;
- aucune mutation production ;
- aucun changement WHC/Render ;
- aucun basculement de branche ;
- aucun secret dans ce document.
