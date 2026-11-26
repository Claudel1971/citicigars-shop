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
- **Prix et promotions**. La copie utilise `prixPack` et `prixBoite` comme montants à payer, puis les relit avant l’ajout et dans le panier. La fiche montre un prix de référence barré quand la promotion du conditionnement est active, que son prix promo correspond au montant enregistré et que la référence calculée est supérieure. Les assortiments conservent leur règle de prix. Pour `CTGNI0013`, les valeurs enregistrées sont 75 000 FCFA pour le pack de 5 et 345 000 FCFA pour la boîte de 23. L’ancien calcul affiché donne respectivement 73 750 et 339 250 FCFA à partir de 14 750 FCFA par cigare. Le 25 novembre 2026, la comparaison des 96 conditionnements tarifés sur les 76 références API a donné quatre écarts, tous sur des références visibles en stock.
- **Disponibilité**. La fiche publique utilise `prixPack > 0` et `prixBoite > 0` pour déterminer les options proposées. La copie exige en plus un statut `IN_STOCK` explicite de la référence, une quantité de pièces valide et un prix calculable. `SOLD_OUT`, `COMING_SOON` et les statuts inconnus bloquent l’ajout. L’API publique ne renvoie aucune quantité de stock par pack ou boîte. La copie ne réserve pas de stock et n’annonce aucun nombre en stock. Une nouvelle lecture valide le prix et l’option avant ajout. Si l’offre a changé, la confirmation reste à faire sur la nouvelle offre.
- **Membres**. La vue applique le statut membre existant et les mêmes restrictions de champs de dégustation côté interface. La copie démarre en mode visiteur. L’API publique renvoie encore des champs de fiche technique dans sa réponse et le dépôt ne fournit pas de session membre serveur pour ce parcours. Le test vérifie la vue visiteur. La vérification d’une session membre réelle et le filtrage de ces champs côté serveur restent à traiter séparément.

L’intégration de l’accueil, des coffrets, de l’ADN Cigare, du CMS et de la commande est en dehors de cette copie. Pour revenir au point de départ, relancer la configuration Vite ordinaire de `origin/main` à l’identifiant ci-dessus.
