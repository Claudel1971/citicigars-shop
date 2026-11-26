# Copie de test CitiCigars

| Référence | Identifiant |
| --- | --- |
| Vitrine validée, branche locale `codex/vitrine-citicigars` | `67b8e88dbdfab6577c7912a9915b40079ee4c4b0` |
| Point de départ Git, `origin/main` au relevé | `c8560ac8d971d472c3758505c626abdd40381d9e` |
| Dernière modification des sources client sur cette base | `7d243fd0c14318e7b361a6f3d9374f4faafa57da` |
| JavaScript servi par la boutique publique au relevé | `bundle.js?v=1767441426628`, SHA-256 `db36833cfd069b2c957f985f6e7c78bdd9f3bf2b63f4d7b02290fd74f42e526b` |

Le site public expose son bundle et son numéro de version. Le lien entre cet artefact WHC et un commit Git reste à confirmer.

## Lancer le test local

Depuis `CitiCigarsShop`, avec Node 24 et Chrome.

```powershell
npm.cmd install --no-save --ignore-scripts --no-audit --no-fund
node node_modules/vite/bin/vite.js --config vitrine-test.config.ts --port 5176 --strictPort
```

Le verrou npm de la base échoue avec `npm ci` pour des dépendances déjà déclarées. La commande ci-dessus installe localement sans mise à jour du verrou. Ouvrir [le catalogue local](http://127.0.0.1:5176/catalogue). La configuration écoute sur la boucle locale et ne réalise que des lectures de l’API publique du catalogue. Son entrée HTML est dédiée au test. Le démarrage standard de la boutique conserve son point d’entrée.

Dans un autre terminal, le scénario ouvre un profil Chrome temporaire et crée les captures et le rapport de résultats dans le dossier indiqué.

```powershell
node scripts/vitrine-test.mjs chemin-des-preuves
```

Définir `CHROME_PATH` si Chrome est installé ailleurs. Le scénario vérifie les données observées lors du test. Le nombre de références, les prix et les statuts peuvent évoluer et nécessiter de revoir les valeurs attendues. Les réponses artificielles restent dans le profil Chrome de test.

## Contrats repris

- **Catalogue et liens**. La copie utilise les deux lectures de `apiService`, une grille et des fiches au style de la vitrine, la visibilité du catalogue et ses filtres combinables. Elle conserve la route publiée `/produit/:sku`, l’alias Git `/p/:sku` et les paramètres des filtres au retour depuis une fiche. Le bouton Partager copie le lien public.
- **Favoris et panier**. La copie reprend `WishlistProvider`, `CartProvider`, les clés locales existantes et l’identité de ligne par SKU et conditionnement. Le panier affiche les montants recalculés à partir d’une lecture actuelle. Les articles locaux restent visibles pendant une panne avec leurs montants masqués. La copie s’arrête au panier. Le stockage local est propre à l’origine du navigateur et les données du navigateur de production ne sont pas importées.
- **Prix et promotions**. La copie utilise `prixPack` et `prixBoite` comme montants à payer, puis les relit avant l’ajout et dans le panier. En réponse à l’audit du 25 novembre 2026, la configuration locale lit dans [vitrine-test-prices.json](./vitrine-test-prices.json) quatre corrections appliquées aux réponses du catalogue et des fiches. Les autres données proviennent de l’API. La fiche montre un prix de référence barré quand la promotion du conditionnement est active, que son prix promo correspond au montant enregistré et que la référence calculée est supérieure. Les assortiments conservent leur règle de prix.
- **Disponibilité**. La fiche publique utilise `prixPack > 0` et `prixBoite > 0` pour déterminer les options proposées. La copie exige en plus un statut `IN_STOCK` explicite de la référence, une quantité de pièces valide et un prix calculable. `SOLD_OUT`, `COMING_SOON` et les statuts inconnus bloquent l’ajout. L’API publique ne renvoie aucune quantité de stock par pack ou boîte. La copie ne réserve pas de stock et n’annonce aucun nombre en stock. Une nouvelle lecture valide le prix et l’option avant ajout. Si l’offre a changé, la confirmation reste à faire sur la nouvelle offre.
- **Membres**. La vue applique le statut membre existant et les mêmes restrictions de champs de dégustation côté interface. La copie démarre en mode visiteur. L’API publique renvoie encore des champs de fiche technique dans sa réponse et le dépôt ne fournit pas de session membre serveur pour ce parcours. Le test vérifie la vue visiteur. La vérification d’une session membre réelle et le filtrage de ces champs côté serveur restent à traiter séparément.

L’intégration de l’accueil, des coffrets, de l’ADN Cigare, du CMS et de la commande est en dehors de cette copie. Pour revenir au point de départ, relancer la configuration Vite ordinaire de `origin/main` à l’identifiant ci-dessus.

## Aperçu HTTPS sur la préproduction

La branche `codex/vitrine-preprod` compile la vitrine complète avec `vitrine-preprod.config.ts`. Le workflow WHC de cette branche sert exclusivement `/essai-vitrine/`. Le build utilise l’API de préproduction et le panier navigateur du même domaine. La configuration locale des quatre corrections tarifaires ne fait pas partie de ce build.

Le checkout réutilise le formulaire existant avec les tarifs relus. Sur l’aperçu, le résultat est un brouillon WhatsApp affiché à l’écran. Les devis Cadeaux, Entreprises et Événements sont également des brouillons. ADN renvoie au parcours existant `/dna/`.

La racine de la préproduction reste le point d’accès à la vitrine précédente. Pour retirer l’aperçu, désactiver le seul dossier `essai-vitrine` sur WHC. Un déploiement suivant conserve l’édition précédente de ce dossier en sauvegarde.

## Candidate de production

`codex/vitrine-production-candidate` part de `5a4d9e8`. Le build local `node node_modules/vite/bin/vite.js build --config vitrine-production.config.ts` lit l’API publique de production. Il utilise les tarifs enregistrés, relus avant la remise à WhatsApp. Le lien WhatsApp ouvre un nouvel onglet et conserve le panier. Les devis utilisent le même contact. L’offre Black Friday s’affiche du 26 au 30 novembre 2026 inclus, heure du Cameroun. La personnalisation offerte s’applique aux trois modèles marqués d’un astérisque sur la grille du brief.

La règle émise dans `routes-apache.txt` cible uniquement les routes de la vitrine. L’Admin, les trois pages légales et ADN continuent d’être traités par la configuration existante. La répétition préalable consiste à tester cette sélection puis le retour au bundle existant dans un navigateur isolé. Pour une éventuelle bascule WHC, sauvegarder et identifier le fichier de routage original avant d’activer la règle, conserver l’ancien bundle et ses médias, puis rétablir atomiquement le fichier original au moindre échec. Contrôler la racine et les quatre routes historiques après restauration.

La production conserve les quatre montants qui diffèrent des montants affichés par la vitrine actuelle. Son chemin `/dna/` sert le bundle générique au lieu du questionnaire. La validation d’une session membre réelle reste ouverte. Ces contrôles sont des conditions d’autorisation de la bascule.
