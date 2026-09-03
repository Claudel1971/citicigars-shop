# Data Dictionary — R0.1 High-Level

Ce dictionnaire décrit les frontières, pas un schéma cible à migrer.

| Concept | Signification | Source de vérité |
|---|---|---|
| Cigar ID | Identité canonique `CTCGXXXXXX` | Cigar Master validé |
| Cigar alias | Alias legacy `CTGXXXXXX` vers canonique après preflight | Cigar Master governance |
| Product | Offre commerciale | Catalogue produit |
| SKU | Unité commerciale/logistique | Product/SKU master |
| Stock identity | `SKU + type + packSize` | Stock Central |
| Movement group | Opération métier | Ledger Stock Central |
| Movement detail | Delta append-only | Ledger Stock Central |
| Stock balance | Projection aggregate | Reconstructible depuis ledger |
| Location balance | Projection par lieu | Transactionnelle, réconciliée |
| Lot balance | Projection provenance/lieu | Transactionnelle, réconciliée |
| LEGACY_UNKNOWN | Fait historique non prouvé | Valeur explicite, jamais inférée |
| Supplier | Fournisseur opérationnel | Purchasing |
| Purchase order | Engagement d’achat | Purchasing; approval à étendre |
| Receipt/item | Réception prouvée | Purchasing + Stock Central |
| Customer | Identité CRM actuelle | CRM; merge governance à créer |
| Interaction | Mémoire relationnelle | Journal CRM append-only |
| Followup | Action CRM planifiée | CRM |
| DNA evidence | Preuve produit | DNA research/evidence |
| Recommendation | Snapshot de proposition | DNA/agent audit, non transactionnel |
| Order/item | Vente commerciale | Sales |
| Payment | Encaissement | Futur cash journal |
| Cost/COGS | Coût économique | Futur landed-cost engine |
| Agent proposal | Recommandation explicable | Agent audit ledger |
| Approved action | Commande autorisée | Action registry + policy engine |
| Context envelope | Contexte scoped, sourcé et expirant | Context & Evidence Fabric |
| Evidence envelope | Preuve, hash, citation et chaîne de possession | Evidence store |
| Agent memory | Résumé/context non autoritatif avec TTL | Context & Evidence Fabric |
| Capability | Tool/action versionné et gouverné | Capability Registry |
| Action state | Transition append-only d’une action | Action Execution Gateway |
| Decision record | Contexte, versions, options et décision | Decision Replay |
| Agent evaluation | Résultat golden/shadow/versionné | Quality Governance |

## Règle

Un read model ou une mémoire agent peut agréger ces faits, jamais les remplacer.
