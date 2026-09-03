# Agent Evaluation & Quality Governance

## 1. Mission

Mesurer avant d’accorder l’autonomie, détecter les régressions et prouver qu’un agent est plus utile que risqué.

## 2. Objets gouvernés

- agent definition/version ;
- prompt/version ;
- model/provider/version ;
- capability/tool version ;
- policy version ;
- dataset/golden-case version ;
- run ;
- metric ;
- evaluation result ;
- promotion/suspension decision.

## 3. Golden cases

Chaque agent possède :

- cas normaux ;
- cas limites ;
- ambiguïtés ;
- données manquantes ;
- contradictions ;
- inputs obsolètes ;
- erreurs tools ;
- timeouts ;
- permissions insuffisantes ;
- prompt injection ;
- tool misuse ;
- action non compensable ;
- cas où la bonne réponse est “je ne sais pas”.

Les cas sont versionnés, reproductibles et séparés des données de production.

## 4. Métriques obligatoires

### Qualité

- groundedness ;
- citation/evidence coverage ;
- factual accuracy ;
- extraction accuracy ;
- tool selection accuracy ;
- tool argument accuracy ;
- deterministic calculation agreement ;
- hallucination/error rate ;
- missing-data acknowledgment ;
- duplicate/replay correctness.

### Humain

- human override rate ;
- acceptance rate ;
- rejection reason ;
- time-to-decision ;
- correction effort ;
- false-positive fatigue ;
- Owner trust score qualitatif.

### Sécurité

- prompt-injection resistance ;
- unauthorized tool attempt rate ;
- scope escape attempts ;
- sensitive-data leakage ;
- policy bypass attempts ;
- self-approval attempts ;
- unsafe action proposal rate.

### Opération

- latency p50/p95/p99 ;
- token/model cost ;
- tool/API cost ;
- timeout/retry/DLQ rate ;
- provider failure rate ;
- completion rate ;
- stale-context rate.

## 5. Modes

1. **Offline eval** : golden cases sans système réel.
2. **Simulation** : tools sandbox et données synthétiques.
3. **Shadow** : vrais inputs autorisés, aucune mutation/sortie.
4. **Assisted** : propositions avec validation humaine obligatoire.
5. **Controlled execution** : actions bornées par policy.

Le passage d’un mode au suivant est une décision gouvernée et auditée.

## 6. Comparaisons modèles/prompts

- même dataset ;
- mêmes tool versions ;
- mêmes budgets ;
- comparaison qualité/coût/latence ;
- analyse des régressions par catégorie ;
- aucune promotion basée uniquement sur une moyenne ;
- maintien de seuils critiques à zéro pour permissions et fabrication de faits.

## 7. Promotion et suspension

Une version peut être promue si :

- golden gates passés ;
- aucun incident critique ;
- coûts dans budget ;
- performance stable ;
- owner/business reviewer accepte ;
- rollback/kill switch vérifiés.

Suspension automatique ou manuelle si :

- policy bypass ;
- data leakage ;
- action non autorisée ;
- hausse d’hallucination ;
- régression tool use ;
- coût anormal ;
- provider/model change non évalué.

## 8. Decision Replay dans l’évaluation

Tout résultat contesté doit être rejouable avec :

- contexte du temps T ;
- evidence ;
- tool outputs ;
- policy ;
- modèle/prompt ;
- décision humaine.

Le replay compare ancienne et nouvelle version sans réexécuter de mutation.

## 9. Reporting

Le Quality Governance dashboard doit montrer :

- versions actives/shadow ;
- dernier eval pass/fail ;
- risques ouverts ;
- acceptance/override ;
- coûts et latence ;
- incidents ;
- capabilities suspendues ;
- décisions de promotion.

Les seuils chiffrés et propriétaires de validation restent à définir par Owner.
