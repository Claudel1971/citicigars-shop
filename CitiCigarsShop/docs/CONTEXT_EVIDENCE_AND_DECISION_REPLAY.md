# Context, Evidence and Decision Replay Contract

## 1. Principe

Les agents partagent un contexte pertinent via un **Context & Evidence Fabric**. Il n’existe aucune mémoire globale mutable partagée entre tous les agents.

Le Fabric référence les sources autoritatives; il ne les copie pas comme nouvelle vérité.

## 2. Context Envelope

```text
contextId
contextVersion
purpose
requestingActor
requestingAgent
permissionsSnapshot
correlationId
causationId
assembledAt
validUntil
items[]
policyConstraints[]
redactionProfile
```

Chaque item :

```text
itemId
kind: FACT | DERIVED_FACT | EVIDENCE | OBSERVATION | INFERENCE | PROPOSAL | MEMORY
domain
sourceSystem
sourceReference
sourceVersion
observedAt
validAt
freshUntil
contentHash
dataClassification
confidence
derivation
evidenceRefs[]
```

## 3. Règles de contexte

- `FACT` vient d’une source autoritative.
- `DERIVED_FACT` vient d’un calcul déterministe versionné.
- `EVIDENCE` est une pièce source immuable ou hashée.
- `INFERENCE` et `PROPOSAL` ne deviennent jamais automatiquement des faits.
- `MEMORY` porte provenance, portée et expiration.
- un agent ne voit que les items permis pour son rôle et son but ;
- les données obsolètes sont signalées, jamais silencieusement présentées comme fraîches ;
- les recommandations sont invalidées si leurs inputs matériels changent.

## 4. Mémoire

### Autorisée

- mémoire d’un run ;
- mémoire d’un workflow ;
- résumé d’un dossier ;
- préférences explicitement approuvées ;
- décisions humaines et leur justification ;
- pointeurs vers preuves.

### Interdite comme autorité

- quantité stock ;
- balance cash ;
- coût ou marge ;
- identité canonique ;
- consentement courant ;
- état d’un PO/receipt ;
- disponibilité ;
- policy ou permission.

La mémoire ne conserve jamais un secret, un token ou un accès brut.

## 5. Evidence Envelope

```text
evidenceId
sourceType
sourceSystem
externalReference
capturedAt
effectiveAt
contentHash
mimeType
location
extracts[]
chainOfCustody[]
accessPolicy
retentionPolicy
redactions[]
```

Une extraction indique la page/zone/citation, la valeur brute, la valeur normalisée, la méthode, le modèle/version et la confiance.

## 6. Decision Record

```text
decisionId
decisionType
actor / agent / service
contextId + contextVersion
evidenceRefs[]
rulesVersion
modelProvider / modelVersion / promptVersion
toolVersions[]
candidateOptions[]
selectedOption
reason
confidence
policyResult
approvalRefs[]
actionRef
createdAt
```

## 7. Decision Replay — MUST dès la fondation

Decision Replay doit permettre de répondre :

- que savait le système à ce moment ?
- quelles données étaient fraîches ou manquantes ?
- quelles preuves ont été utilisées ?
- quelles versions de règles, tools, modèles et prompts ?
- quelles options ont été considérées ?
- qui a proposé, approuvé et exécuté ?
- quel résultat et quelle compensation ?

Le replay utilise les snapshots/hashes du temps T. Il ne remplace pas rétroactivement les anciennes données par leur valeur actuelle.

## 8. Limites

- Replay n’est pas réexécution automatique.
- Une simulation de replay s’exécute en sandbox/shadow.
- Les données soumises à suppression légale peuvent être représentées par hash/métadonnées selon policy.
- Une preuve externe non archivable conserve au minimum URL/référence, timestamp, hash et citation permise.
