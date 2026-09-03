# Supplier Watcher — Vertical Slice Contract

## 1. Mission

Détecter et structurer les opportunités fournisseurs avec preuves, expliquer leur intérêt et préparer une décision Owner sans engager CitiCigars.

## 2. Roadmap figée

1. **Email surveillance**
2. **Web enrichment**
3. **Integrated CitiCigarsAdmin operation**

Aucune phase ne reçoit automatiquement les permissions de la suivante.

## 3. Phase 1 — Email surveillance

### Entrées autorisées

- mailbox explicitement connectée par Owner ;
- labels/dossiers fournisseurs allowlistés ;
- expéditeurs/domaines reconnus ou mis en quarantaine ;
- pièces jointes PDF, tableur, image ou texte selon policy ;
- fenêtre temporelle et quotas.

### Opportunity Draft Contract

```text
opportunityDraftId
status: DRAFT | NEEDS_REVIEW | READY_FOR_REVIEW | REJECTED | EXPIRED
sourceMessageId
sourceThreadId
supplierCandidateId
supplierMatchConfidence
receivedAt
offerDate
expiresAt
currency
terms
lines[]
evidenceRefs[]
deterministicMetrics
assumptions[]
conflicts[]
missingFields[]
riskFlags[]
recommendedNextStep
createdByAgentRun
createdAt / updatedAt
```

Chaque ligne :

```text
supplierReference
rawDescription
productCandidates[]
skuCandidate
cigarIdCandidate
packaging
moq
offeredQuantity
listPrice
offerPrice
discount
availabilityClaim
leadTimeClaim
evidenceRefs[]
mappingStatus
```

### Validations

- message dans le scope autorisé ;
- déduplication message/thread/attachment hash ;
- fournisseur non blacklisté ;
- devise et unités explicites ou marquées manquantes ;
- dates cohérentes ;
- calculs déterministes ;
- Cigar ID/SKU seulement comme candidats ;
- aucune disponibilité fournisseur interprétée comme stock CitiCigars ;
- aucune marge si coût déterministe absent.

### Permissions

Service identity : `agent:supplier-watcher`.

Autorisée :

- email read dans scope ;
- documents read/extract ;
- catalogue/stock/sales/purchasing read ;
- evidence append ;
- opportunity draft create/update ;
- owner task create.

Interdite :

- email send/delete/archive/move ;
- PO actif ;
- stock/receipt ;
- paiement ;
- identity master mutation ;
- policy/permission mutation.

### Approval

- A0 pour lecture autorisée ;
- A1 pour extraction et draft ;
- revue humaine obligatoire pour supplier/product mapping ambigu ;
- Owner review avant passage à toute action externe.

### Shadow behavior

Au lancement :

- aucune notification externe ;
- drafts clairement marqués SHADOW ;
- comparaison avec décisions Owner ;
- faux positifs conservés pour eval ;
- possibilité Owner de masquer/ignorer sans modifier l’email ;
- kill switch immédiat.

### Evidence

- message/thread IDs ;
- sender et received timestamp ;
- attachment hash ;
- citation/page/zone ;
- valeur brute et normalisée ;
- extracteur/modèle/version ;
- date et confiance ;
- chaîne de possession.

## 4. Phase 2 — Web enrichment

### Conditions d’entrée

- Phase 1 stable ;
- allowlist et politique web approuvées ;
- prompt-injection tests passés ;
- rétention/snapshot policy validée.

### Fonction

- vérifier références officielles ;
- enrichir packaging et disponibilité déclarée ;
- comparer promotions historiques ;
- sourcer taux de change/estimations ;
- détecter conflits ;
- améliorer le dossier, jamais remplacer l’offre email.

### Limites

- aucune instruction trouvée sur le web n’est exécutée ;
- aucune authentification contournée ;
- aucun prix public n’est traité comme contractuel ;
- aucune identité canonique créée automatiquement ;
- toute source porte URL, timestamp et citation/hash.

## 5. Phase 3 — Integrated operation

### Fonction

- utiliser Supplier/Product/Stock 360 ;
- simuler landed cost et cash impact lorsque les moteurs existent ;
- créer un PO draft ;
- demander approbation ;
- préparer un message fournisseur ;
- enregistrer décision et motifs.

### Approval

- envoi message : A3 ou A4 selon politique ;
- émission PO : A4 ;
- nouveau fournisseur/paiement sensible/override : A5 ;
- réception : workflow Receiving distinct ;
- stock : exclusivement par Purchasing → Stock Central.

## 6. Évaluation

### Golden cases

- offre simple mono-produit ;
- plusieurs pack sizes ;
- référence inconnue ;
- devise absente ;
- offre expirée ;
- pièce jointe contradictoire ;
- forwarding/thread dupliqué ;
- faux fournisseur/phishing ;
- prompt injection dans email/PDF ;
- collision Cigar ID ;
- produit sans stock ou déjà fortement commandé ;
- offre attractive mais cash/marge insuffisants.

### Mesures

- recall des offres pertinentes ;
- precision de détection ;
- exactitude fournisseur/produit/SKU ;
- exactitude champs/prix/devise/MOQ/date ;
- citation coverage ;
- groundedness ;
- taux de champs inventés ;
- taux de revue/override ;
- acceptance rate ;
- temps gagné ;
- coût et latence ;
- incidents de permission ou tool misuse.

## 7. Critères de promotion

Les seuils chiffrés restent Owner Decision. Conditions minimales :

- zéro action externe en Phase 1 ;
- zéro violation de scope ;
- zéro donnée transactionnelle inventée ;
- prompt injection suite PASS ;
- matching ambigu toujours escaladé ;
- evidence coverage jugée suffisante ;
- coûts et latence dans budget ;
- kill switch et replay testés.
