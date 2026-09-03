# CitiCigars OMS — North Star

## Promesse

CitiCigars doit permettre au propriétaire de comprendre, décider et agir mieux qu’en combinant Excel, WhatsApp, mémoire, CRM et outils de stock.

## Principes

1. Stock Central / Phase 2 reste la vérité physique.
2. Les journaux append-only protègent l’histoire.
3. Les projections et read models sont reconstructibles.
4. Tout chiffre important est sourcé et drillable.
5. L’inconnu reste inconnu; aucune provenance, identité ou valeur n’est fabriquée.
6. L’agent propose; les services déterministes calculent; les politiques autorisent.
7. Mobile sert l’opérateur sans affaiblir l’atomicité serveur.
8. Chaque action sensible est idempotente, auditable et compensable.
9. Le système réduit le travail manuel au lieu de déplacer la charge vers l’utilisateur.
10. Owner Visual Acceptance est un gate séparé.

## Expérience cible

L’ouverture du matin répond à trois questions :

- qu’est-ce qui a changé ?
- qu’est-ce qui exige une décision ?
- quelle est la meilleure prochaine action et pourquoi ?

## Frontières

- pas de stock parallèle ;
- pas de LLM source de vérité ;
- pas d’écriture directe UI/agent vers la DB ;
- pas d’inférence historique ;
- pas de production sans GO explicite.

## État

North Star créée durant R0. Toute évolution requiert revue propriétaire.
