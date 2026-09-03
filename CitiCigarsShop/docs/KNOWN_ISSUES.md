# Known Issues — après R0.1

## MUST

1. La convention Owner `CTCGXXXXXX` est décidée mais son préflight et son document canonique de migration ne sont pas implémentés.
2. Handoffs CRM/DNA demandés absents du snapshot et des branches historiques inspectées.
3. Auth admin partagée, token base64 sans expiration/révocation.
4. Routes legacy de mutation insuffisamment protégées.
5. RBAC/capability matrix est documenté mais non implémenté.
6. Vérité cash non modélisée comme journal append-only.
7. Landed cost, COGS et marge réelle non déterministes/absents.
8. Reversal vente, transfert générique et bundle physique sont séparés comme futurs contrats mais restent non conçus en détail.
9. Ambiguïté MySQL/PostgreSQL et sécurité TLS de la connexion active.
10. CMS/assets locaux non versionnés et potentiellement non durables.
11. Backup/restore, RTO/RPO et incident procedure non figés pour V2.
12. Import historique utilise des identifiants/contrats différents et doit rester quarantiné.
13. Seuils d’approbation, scope email, rétention et gates shadow Supplier Watcher restent Owner Decision.

## SHOULD

- fusion d’identités CRM ;
- consentement et rétention ;
- coûts/écarts de réception ;
- PO approvals ;
- data freshness sur recommandations ;
- observabilité structurée ;
- réconciliation périodique et exception queue.

## DO NOT

Ne pas “résoudre” ces points par migration spéculative, backfill inventé, merge de `feature/crm-phase1` ou contournement de Stock Central.
