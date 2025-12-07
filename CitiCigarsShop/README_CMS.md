# Mini CMS - Gestion du Contenu

## Aperçu

Ce mini système de gestion de contenu (CMS) permet de modifier les textes du site sans toucher au code source.

## Accès à l'administration

1. Aller sur `/admin` et se connecter avec les identifiants admin (admin/admin)
2. Dans le menu latéral, cliquer sur **"Contenu (CMS)"**
3. Entrer le mot de passe CMS pour pouvoir modifier le contenu

## Configuration du mot de passe CMS

Le mot de passe CMS est défini par la variable d'environnement `CMS_ADMIN_PASSWORD`.

- **Par défaut** : `citicigars2024`
- **Pour le modifier** : Définir `CMS_ADMIN_PASSWORD` dans les secrets Replit

```bash
# Dans les secrets Replit ou .env
CMS_ADMIN_PASSWORD=VotreMotDePasseSecurise
```

## Structure du contenu

Le contenu est stocké dans le fichier `server/content.json` avec la structure suivante :

```json
{
  "home": {
    "heroSlides": [
      {
        "title": "Titre du slide",
        "subtitle": "Sous-titre",
        "ctaText": "Texte du bouton",
        "ctaLink": "/lien"
      }
    ],
    "brandStory": {
      "icon": "⚜",
      "title": "Titre de la section",
      "text": "Texte descriptif",
      "ctaText": "Texte du bouton",
      "ctaLink": "/lien"
    }
  },
  "footer": {
    "tagline": "Slogan du footer",
    "legalNotice": "Mention légale"
  },
  "_meta": {
    "lastUpdated": "2024-01-01T00:00:00.000Z",
    "updatedBy": "admin"
  }
}
```

## Sections éditables

### Page d'accueil

1. **Carousel Hero** - Les 3 slides du carrousel avec titre, sous-titre et bouton
2. **Section "Notre Histoire"** - Icône, titre, texte et bouton de la section brand story

### Footer

1. **Tagline** - Le slogan affiché sous "Citi Cigars"
2. **Mention légale** - Le texte légal en bas de page

## API

### GET /api/content
Récupère le contenu actuel (public, pas d'authentification requise).

### POST /api/content/login
Authentification CMS.
- Body: `{ "password": "votremotdepasse" }`
- Retourne un token à utiliser pour les modifications

### PUT /api/content
Met à jour le contenu (authentification requise).
- Header: `Authorization: Bearer <token>`
- Body: Le contenu JSON complet

## Ajouter de nouvelles sections

1. Ajouter les nouvelles clés dans `server/content.json`
2. Mettre à jour le `defaultContent` dans `client/src/context/ContentContext.jsx`
3. Ajouter les champs dans `client/src/components/admin/ContentManager.jsx`
4. Utiliser `useContent()` dans les composants front pour afficher le contenu

## Sécurité

- Validation côté serveur (longueur max, suppression des scripts)
- Token d'authentification basé sur le mot de passe
- Stockage du token en sessionStorage (expire à la fermeture du navigateur)

## Fichiers clés

| Fichier | Description |
|---------|-------------|
| `server/content.json` | Données du contenu |
| `server/routes.ts` | Routes API (GET/PUT /api/content) |
| `client/src/context/ContentContext.jsx` | Provider React + valeurs par défaut |
| `client/src/components/admin/ContentManager.jsx` | Interface d'administration |
