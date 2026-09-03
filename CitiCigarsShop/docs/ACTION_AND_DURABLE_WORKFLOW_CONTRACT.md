# Action State Machine and Durable Workflow Contract

## 1. Action state machine

```text
DRAFT
  → PROPOSED
  → VALIDATED
  → AWAITING_APPROVAL
  → APPROVED
  → EXECUTING
  → SUCCEEDED
```

Branches terminales ou compensatoires :

- `REJECTED`
- `EXPIRED`
- `CANCELLED`
- `FAILED`
- `COMPENSATION_REQUIRED`
- `COMPENSATING`
- `COMPENSATED`

## 2. Conditions de transition

| Transition | Conditions |
|---|---|
| DRAFT → PROPOSED | inputs et preuves minimaux |
| PROPOSED → VALIDATED | schéma, sources, fraîcheur et validators PASS |
| VALIDATED → AWAITING_APPROVAL | policy calcule approbateurs/seuils |
| AWAITING_APPROVAL → APPROVED | identité, rôle, step-up et séparation valides |
| APPROVED → EXECUTING | revalidation des inputs, approval non expirée, idempotency |
| EXECUTING → SUCCEEDED | Domain Service confirme résultat |
| EXECUTING → FAILED | erreur classifiée et auditée |
| FAILED → COMPENSATION_REQUIRED | effet partiel/externe possible |
| COMPENSATING → COMPENSATED | action compensatoire confirmée |

Une transition est append-only et contient actor, timestamp, raison, hashes, policy et références.

## 3. Idempotence

Chaque action possède :

- idempotency key ;
- hash normalisé des inputs ;
- scope d’unicité ;
- règle de replay ;
- résultat original réutilisable ;
- refus explicite si la clé est réutilisée avec un autre payload.

## 4. Compensation

- une compensation est une nouvelle action ;
- elle référence l’action originale ;
- elle ne supprime pas l’historique ;
- elle possède sa propre policy et approbation ;
- un message envoyé est compensé par suivi/cancellation, jamais “désenvoyé” fictivement ;
- une opération stock future utilise un mouvement compensatoire, jamais UPDATE/DELETE.

## 5. Durable workflow contract

```text
workflowId / workflowVersion
runId
businessKey
correlationId / causationId
initiator
serviceIdentity
contextRef
state
currentStep
stepHistory[]
leaseOwner / leaseExpiresAt
heartbeatAt
retryPolicy
timeoutPolicy
dedupeKey
waitingFor[]
cancelPolicy
compensationPlan
resultRefs[]
errorClass
createdAt / completedAt
```

## 6. Exigences d’orchestration

- persistance avant exécution ;
- reprise après crash ;
- retries bornés et classifiés ;
- exponential backoff avec jitter ;
- DLQ et procédure de résolution ;
- human wait state sans worker bloqué ;
- cancellation sûre ;
- timeout par step et workflow ;
- concurrence contrôlée par business key ;
- version pinning ;
- replay en shadow ;
- limites de coût et débit ;
- aucune transaction DB longue couvrant un appel externe.

## 7. Transactional outbox

Un événement métier et son outbox record sont écrits dans la même transaction du Domain Service. Un publisher séparé livre l’événement au backbone.

L’échec de publication :

- ne réécrit pas le fait métier ;
- déclenche retry ;
- reste visible ;
- finit en DLQ si épuisé ;
- ne produit pas une deuxième transaction métier.

## 8. Supplier Watcher Phase 1 workflow

```text
EMAIL_DETECTED
→ SCOPE_VALIDATED
→ CONTENT_CAPTURED
→ EVIDENCE_REGISTERED
→ TERMS_EXTRACTED
→ IDENTITIES_PROPOSED
→ DETERMINISTIC_ANALYSIS
→ OPPORTUNITY_DRAFTED
→ OWNER_REVIEW_QUEUED
→ CLOSED
```

Branches : duplicate, out-of-scope, malformed, needs-human-mapping, expired, failed extraction.

Phase 1 ne contient aucune étape send, PO issue, receipt ou stock mutation.
