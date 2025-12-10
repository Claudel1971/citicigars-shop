# Guide de Déploiement - WHC.ca (Web Hosting Canada)

## IMPORTANT : Avant de déployer

Avant de uploader les fichiers sur WHC.ca, vous devez activer la configuration MySQL :

### Modifier les imports dans le code

1. **server/db.ts** - Remplacer le contenu par :
```typescript
export * from "./db.mysql";
```

2. **shared/schema.ts** - Remplacer le contenu par :
```typescript
export * from "./schema.mysql";
```

3. **server/storage.ts** - Remplacer le contenu par :
```typescript
export * from "./storage.mysql";
```

Cela basculera l'application de PostgreSQL vers MySQL.

---

## Prérequis

1. Un compte WHC.ca avec hébergement web (plan Starter ou supérieur)
2. Accès SSH activé
3. Node.js activé via cPanel

---

## Étape 1 : Créer la base de données MySQL

1. Connectez-vous à cPanel
2. Allez dans **MySQL Databases**
3. Créez une nouvelle base de données : `citicigars_db`
4. Créez un utilisateur : `citicigars_user` avec un mot de passe fort
5. Associez l'utilisateur à la base de données avec **TOUS LES PRIVILÈGES**

**Notez vos informations :**
- Host: `localhost`
- Database: `votre_cpanel_username_citicigars_db`
- User: `votre_cpanel_username_citicigars_user`
- Password: `votre_mot_de_passe`

---

## Étape 2 : Configurer Node.js via cPanel

1. Allez dans **cPanel → Software → Setup Node.js App**
2. Cliquez **Create Application**
3. Configurez :
   - **Node.js version** : 20.x (ou la plus récente disponible)
   - **Application mode** : Production
   - **Application root** : `citicigars` (ou le dossier où vous uploadez)
   - **Application URL** : votre domaine
   - **Startup file** : `app.js`
4. Cliquez **Create**

---

## Étape 3 : Uploader les fichiers

### Option A : Via Git (recommandé)

1. Connectez-vous en SSH
2. Naviguez vers votre dossier :
   ```bash
   cd ~/citicigars
   ```
3. Clonez le repo :
   ```bash
   git clone https://github.com/VOTRE_USERNAME/CitiCigarsShop.git .
   ```

### Option B : Via File Manager / FTP

1. Téléchargez le projet depuis Replit
2. Uploadez tous les fichiers dans le dossier de l'application

---

## Étape 4 : Installer les dépendances

1. Dans cPanel → Setup Node.js App, cliquez sur votre application
2. Cliquez **Run NPM Install**

Ou via SSH :
```bash
cd ~/citicigars
source /home/USERNAME/nodevenv/citicigars/20/bin/activate
npm install --production
```

---

## Étape 5 : Configurer les variables d'environnement

Dans cPanel → Setup Node.js App → Environment variables :

```
NODE_ENV=production
DATABASE_URL=mysql://USERNAME_citicigars_user:PASSWORD@localhost/USERNAME_citicigars_db
CMS_ADMIN_PASSWORD=votre_mot_de_passe_admin
```

Remplacez :
- `USERNAME` par votre nom d'utilisateur cPanel
- `PASSWORD` par le mot de passe de la base de données

---

## Étape 6 : Build et Migration

Via SSH :
```bash
cd ~/citicigars
source /home/USERNAME/nodevenv/citicigars/20/bin/activate

# Build le projet
npm run build

# Exécuter les migrations
npx drizzle-kit push --config=drizzle.config.mysql.ts
```

---

## Étape 7 : Démarrer l'application

1. Dans cPanel → Setup Node.js App
2. Cliquez **Restart** sur votre application

---

## Étape 8 : Importer les données

Une fois l'application démarrée, allez sur :
`https://votre-domaine.com/admin`

Et importez vos produits via le panneau d'administration.

---

## Résolution de problèmes

### Erreur "Application not starting"
- Vérifiez les logs dans : `~/citicigars/stderr.log`
- Assurez-vous que le fichier `app.js` existe

### Erreur de connexion MySQL
- Vérifiez que DATABASE_URL est correct
- Format : `mysql://user:password@localhost/database`

### Problèmes de permissions
```bash
chmod 755 ~/citicigars
chmod 644 ~/citicigars/*.js
```

---

## Support

Pour toute assistance :
- Support WHC.ca : 1-514-504-2113
- Documentation cPanel Node.js : https://docs.cpanel.net/cpanel/software/setup-nodejs-app/
