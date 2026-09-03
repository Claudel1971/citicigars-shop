# Authority and Permissions Matrix

## 1. Hiérarchie

### Owner / Super Admin

Autorité ultime sur :

- attribution et révocation des rôles ;
- création d’un autre Owner ;
- critical policies et thresholds ;
- activation des capabilities R4 ;
- changements de source de vérité ;
- migrations sensibles ;
- émission d’engagements majeurs ;
- accès audit complet ;
- kill switches ;
- production GO.

L’Owner reste soumis à l’audit. Son statut ne permet pas d’effacer l’historique.

### Admin

Peut, si délégué :

- gérer des rôles opérationnels non supérieurs au sien ;
- assigner des capacités dans son périmètre ;
- créer/suspendre des utilisateurs opérationnels ;
- gérer des capabilities R0-R2 selon policy ;
- approuver certaines actions R3 sous seuil ;
- consulter les audits de son périmètre.

Un Admin ne peut pas :

- s’auto-élever ;
- créer ou promouvoir un Owner ;
- retirer l’accès de l’Owner ;
- désactiver l’audit ;
- modifier/contourner une critical policy ;
- activer une capability R4 ;
- modifier les permissions de son propre rôle ;
- autoriser production ;
- effacer son historique.

### Operational roles

Exemples à confirmer :

- Stock Operator ;
- Purchasing Operator ;
- CRM/Sales Operator ;
- Receiving Operator ;
- DNA Curator ;
- Content Editor ;
- Finance Operator ;
- Auditor / Read Only.

Le rôle limite les capacités visibles et exécutables côté serveur.

### Agent et Service Identity

- aucun héritage automatique des permissions de son créateur ;
- permissions explicites et minimales ;
- restriction par environnement, domaine, canal et capability version ;
- pas de login interactif ;
- secrets séparés et rotatifs ;
- identité initiatrice conservée avec l’identité humaine approbatrice.

## 2. Authority matrix des vérités

| Domaine | Autorité | Écriture autorisée | Agent |
|---|---|---|---|
| Stock/ledger | Stock Central services | Stock service seulement | READ/propose, jamais direct |
| Projections stock | Transaction Stock Central | Writer unique | READ |
| Product/SKU | Product master service | rôle master délégué | propose mapping |
| Cigar ID | Cigar Master governance | Owner/master steward | propose alias/conflict |
| DNA publié | Curator approval | DNA service | research/propose |
| CRM interactions | CRM service | opérateur/canal approuvé | draft/approved append |
| Sales | Sales service | sales role | propose; execute sous policy |
| Purchasing | Purchasing service | purchasing role | draft; issue approved |
| Receipt | Purchasing + Stock services | receiving role | extract/propose |
| Cash | futur Cash Journal | finance role | READ/propose |
| Cost/COGS | futur Cost Engine | déterministe | READ/simulate |
| CMS publié | Content service | publisher role | draft; publish approved |
| Policy | Policy service | Owner pour critical | aucune auto-modification |
| Audit | Audit service append-only | systèmes autorisés | append automatique |

## 3. Niveaux d’approbation

| Niveau | Autorité | Exemple |
|---|---|---|
| A0 | aucune approbation, permission seule | lecture autorisée |
| A1 | auto sous policy | extraction, score, draft interne |
| A2 | opérateur compétent | receipt draft confirmé sans écart |
| A3 | Admin délégué | message externe ou action sous seuil |
| A4 | Owner/Super Admin | PO majeur, identity master, critical policy |
| A5 | double approbation incluant Owner | fournisseur nouveau à risque, paiement sensible, override critique |

## 4. Séparation des rôles

- proposer ≠ approuver ;
- approuver ≠ exécuter pour les actions critiques ;
- gérer une capability ≠ modifier ses evals ;
- gérer les rôles ≠ s’auto-promouvoir ;
- administrer un domaine ≠ désactiver l’audit ;
- agent initiateur ≠ approbateur.

## 5. Contrôles obligatoires

- deny by default ;
- enforcement serveur ;
- permissions versionnées ;
- changements de rôle auditables ;
- sessions et approvals expirants ;
- step-up authentication pour actions critiques ;
- revalidation juste avant exécution ;
- emergency suspension conservant l’historique ;
- revue périodique des accès.
