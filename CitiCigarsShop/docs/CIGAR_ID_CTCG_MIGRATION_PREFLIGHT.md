# Cigar ID `CTCGXXXXXX` — Migration Preflight Plan

## 1. Décision Owner

- Canonique : `CTCGXXXXXX`.
- Legacy éligible : `CTGXXXXXX`.
- Transformation : insertion de `C` entre `T` et `G`.
- Exemple : `CTG123456` → `CTCG123456`.

Ce document ne lance aucune migration.

## 2. Hypothèse à confirmer

`XXXXXX` représente exactement six chiffres et conserve les zéros initiaux.

Regex proposées :

- canonique : `^CTCG[0-9]{6}$`
- legacy migrable : `^CTG[0-9]{6}$`

## 3. Préflight MUST

### Inventaire

- toutes les valeurs Cigar ID ;
- casse, whitespace et caractères invisibles ;
- longueurs de colonnes ;
- contraintes et indexes ;
- foreign keys ;
- données statiques ;
- CSV/Excel ;
- CMS ;
- DNA evidence ;
- CRM notes/interactions ;
- imports/exports ;
- URLs, QR/barcodes et intégrations.

### Collisions

Pour chaque `CTGnnnnnn` :

- cible `CTCGnnnnnn` ;
- cible déjà présente ou non ;
- même cigare prouvé ou conflit ;
- nombre de références source/cible ;
- décision requise.

### Références

Créer un rapport par table/fichier/système :

- valeur legacy ;
- cible canonique ;
- nombre de références ;
- capacité de migration ;
- capacité d’alias resolution ;
- risque de troncature ;
- owner technique.

## 4. Alias contract

```text
aliasId
aliasValue
canonicalCigarId
aliasType: LEGACY_CTG
status
source
evidenceRef
migrationRuleVersion
createdAt
createdBy
```

Contraintes :

- alias unique ;
- canonical ID unique ;
- aucune suppression si référencé ;
- résolution idempotente ;
- chaîne d’alias interdite ou aplatie ;
- audit obligatoire.

## 5. Règles de transformation

- transformer uniquement un match legacy strict ;
- ne jamais transformer un canonique existant ;
- ne pas deviner les formats invalides ;
- ne pas modifier le suffixe ;
- ne jamais traiter le suffixe comme nombre ;
- ne pas réécrire les pièces historiques non structurées ;
- préserver valeur originale dans audit/alias ;
- refuser toute collision non arbitrée.

## 6. Gates

1. inventory complete ;
2. zero unreviewed collision ;
3. zero truncation ;
4. reference matrix complete ;
5. alias resolution tested ;
6. idempotent dry-run ;
7. before/after reconciliation ;
8. rollback/restore proof ;
9. Owner approval ;
10. migration séparée, forward-only.

## 7. Risque critique

Une collision où `CTGnnnnnn` et `CTCGnnnnnn` désignent deux cigares différents interdit la migration automatique de cet ID. Elle ne remet pas en cause la convention globale, mais exige un arbitrage et une stratégie d’alias spécifique.

## 8. DO NOT

- aucune migration pendant R0.1 ;
- aucun UPDATE massif sans preflight ;
- aucun changement de Stock Central ;
- aucune génération depuis SKU/nom ;
- aucun merge automatique de deux cigares ;
- aucune suppression de l’ID legacy dans l’audit.
