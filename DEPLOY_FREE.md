# 🚀 Guide de Déploiement 100 % Gratuit (Cloudflare Pages)

Ce guide détaille le déploiement de **VIDNEX** sur **Cloudflare Pages** : **0 € à vie, sans carte bancaire**, avec **bande passante CDN illimitée** et **100 000 requêtes serverless Pages Functions gratuites par jour**.

---

## ⚡ Caractéristiques de l'Hébergement

- **0 € / mois à vie** : Aucune carte bancaire requise.
- **Bande passante CDN mondiale illimitée**.
- **Pages Functions natives (`/functions/api`)** : Exécution au plus près des utilisateurs sur le réseau Edge de Cloudflare.
- **Zéro API tierce** : Ni RapidAPI, ni Cobalt, ni conteneur Docker.

---

## 📋 Déploiement en 4 Étapes

### Étape 1 : Créer votre compte Cloudflare (Gratuit)
1. Rendez-vous sur **[dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)**.
2. Créez un compte gratuit avec votre adresse email.

### Étape 2 : Connecter votre dépôt GitHub
1. Dans le tableau de bord Cloudflare, allez dans **Workers & Pages**.
2. Cliquez sur **Create** > onglet **Pages** > **Connect to Git**.
3. Sélectionnez votre dépôt GitHub : `VIDNEX`.

### Étape 3 : Configurer les paramètres de compilation
Remplissez les champs exactement comme suit :

| Paramètre | Valeur | Description |
| :--- | :--- | :--- |
| **Project name** | `vidnex` | Nom du projet |
| **Production branch** | `main` | Branche Git de production |
| **Framework preset** | `Vite` | Preset Vite |
| **Build command** | `npm run build` | Compilation Vite (`tsc && vite build`) |
| **Build output directory** | `dist` | Dossier de sortie statique |
| **Root directory** | `/` *(laisser vide)* | Racine du projet |

### Étape 4 : Variables d'environnement (Optionnel)
- `IG_SESSION_ID` *(Optionnel)* : Pour déverrouiller l'accès aux contenus Instagram nécessitant une session.
  Peut être ajouté via l'interface Cloudflare Pages ou avec :
  ```bash
  npx wrangler pages secret put IG_SESSION_ID
  ```

Cliquez sur **Save and Deploy**. Votre site sera en ligne en moins d'une minute !
