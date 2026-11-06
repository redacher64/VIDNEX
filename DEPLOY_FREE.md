# 🚀 Guide de Déploiement 100% Gratuit & Illimité (Cloudflare Pages)

Ce guide détaille le déploiement de **VIDNEX** (`vidnex.space`) sur **Cloudflare Pages** : **0 € à vie, sans carte bancaire**, avec **bande passante CDN mondiale illimitée** et **100 000 requêtes Edge Functions serverless gratuites par jour**.

---

## ⚡ Pourquoi Cloudflare Pages ?

- **0 € / mois à vie** : Aucune carte bancaire requise à l'inscription.
- **Bande passante CDN illimitée** : Pas de facture surprise en cas de pic de trafic mondial.
- **Pages Functions natives (`/functions/api`)** : Les moteurs d'extraction et de téléchargement forcé s'exécutent directement sur le réseau mondial Edge de Cloudflare à moins de 50 ms de chaque utilisateur.
- **Zéro serveur Docker à maintenir** : Fini les conteneurs payants ou les contraintes d'hibernation de Hugging Face Spaces.
- **Zéro abonnement API payant** : Aucune clé RapidAPI payante requise.

---

## 🛠️ Architecture des Moteurs 100% Gratuits

VIDNEX intègre une suite de moteurs d'extraction multi-niveaux sans quotas stricts ni frais cachés :

1. **TikTok (`/functions/api/extract.ts`)** :
   - Moteur direct TikWM : Vidéos Full HD 1080p sans filigrane, carrousels photos haute résolution, pistes audio MP3 extraites, photos de profil HD.
2. **Instagram (`/functions/api/extract.ts`)** :
   - **Niveau 1** : Analyse officielle de l'embed Instagram (`/p/{shortcode}/embed/captioned/`) extrayant les flux vidéo MP4 et images HD sans cookie.
   - **Niveau 2** : Requêtes GraphQL anonymes avec l'en-tête officiel `X-IG-App-ID: 936619743392459` pour les carrousels multi-slides et Reels.
   - **Niveau 3** : Moteur de secours sur instances publiques et libres de Cobalt (`api.cobalt.tools`, `capi.wuk.sh`, `cobalt.kwiatekm.tokyo`).
   - **Profils** : Résolution des avatars HD 1080×1080 via OpenGraph direct.
3. **X / Twitter** :
   - Moteurs ouverts BetterTwitFix / vxTwitter et syndication officielle Twitter (`tweet-result`).
4. **Téléchargement forcé mobile & desktop (`/functions/api/download.ts`)** :
   - Proxy de flux avec en-têtes `Content-Disposition: attachment; filename="..."` et bypass CORS pour forcer l'enregistrement direct des fichiers sur iOS, Android, macOS et Windows.

---

## 📋 Déploiement en 4 Étapes (Durée : ~3 minutes)

### Étape 1 : Créer votre compte Cloudflare (Gratuit)
1. Rendez-vous sur **[dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)**.
2. Créez un compte avec votre adresse email (aucune carte bancaire requise).

### Étape 2 : Connecter votre dépôt GitHub
1. Dans le menu de gauche, cliquez sur **Compute (Workers & Pages)** → **Overview**.
2. Cliquez sur le bouton bleu **Create** (ou **Create application**), puis sélectionnez l'onglet **Pages**.
3. Choisissez **Connect to Git** et autorisez l'accès à votre compte GitHub.
4. Sélectionnez votre dépôt : `VIDNEX` (ou `votre-pseudo/VIDNEX`).

### Étape 3 : Configurer les paramètres de build
Remplissez les champs de configuration exactement comme suit :

| Paramètre | Valeur | Description |
| :--- | :--- | :--- |
| **Project name** | `vidnex` (ou au choix) | Nom de votre projet Cloudflare |
| **Production branch** | `main` | Branche principale synchronisée |
| **Framework preset** | `Vite` | Détection automatique Vite |
| **Build command** | `npm run build` | Compilation TypeScript + Vite |
| **Build output directory** | `dist` | Dossier des fichiers statiques générés |
| **Root directory** | `/` *(laisser vide)* | Racine du projet |

> [!NOTE]
> **Aucune variable d'environnement obligatoire** n'est nécessaire ! Les moteurs fonctionnent nativement sans aucune clé secrète.
> *(Optionnel)* Si vous disposez d'un compte Google AdSense, vous pouvez ajouter la variable d'environnement `VITE_ADSENSE_CLIENT_ID` avec votre identifiant `ca-pub-XXXXXXXXXXXXXXXX`.

### Étape 4 : Déployer
1. Cliquez sur **Save and Deploy**.
2. Cloudflare Pages lance le build :
   - Installation des dépendances
   - Compilation Vite vers `dist/`
   - Déploiement automatique des Pages Functions depuis le dossier `/functions`
3. En moins de 60 secondes, votre site est en ligne avec une URL du type :
   ```text
   https://vidnex.pages.dev
   ```

---

## 🌐 Lier votre domaine personnalisé (Ex: `vidnex.space`)

1. Dans votre projet Cloudflare Pages, allez dans l'onglet **Custom domains**.
2. Cliquez sur **Set up a custom domain**.
3. Saisissez votre nom de domaine (ex: `vidnex.space` ou `www.vidnex.space`).
4. Si votre domaine est déjà géré par Cloudflare DNS, la validation SSL/TLS automatique se fait en 1 clic. Si votre domaine est chez un registrar externe (Namecheap, Hostinger, OVH), ajoutez le CNAME indiqué par Cloudflare.
5. Cloudflare active automatiquement le certificat HTTPS gratuit avec renouvellement automatique à vie.

---

## 💻 Développement Local

Pour lancer et tester VIDNEX localement sur votre ordinateur :

```powershell
# 1. Cloner le projet (si ce n'est pas déjà fait)
git clone https://github.com/redacher64/VIDNEX.git
cd VIDNEX

# 2. Lancer le serveur de développement local
npm run dev
```

L'application est immédiatement accessible sur `http://localhost:3000` (ou `http://localhost:5173`) avec prise en charge complète des API locales (`server.ts` + `server/api/`).

---

## ✅ Matrice de Test QA

Pour valider le bon fonctionnement de votre déploiement :
1. **TikTok Vidéo** : Collez un lien TikTok standard (ex: `https://www.tiktok.com/@.../video/...`) → Téléchargement MP4 1080p sans filigrane immédiat.
2. **TikTok Carrousel** : Collez un lien de diaporama photos TikTok → Affichage des slides avec téléchargement individuel ou de l'audio MP3.
3. **Instagram Reel** : Collez un lien Reel (`https://www.instagram.com/reel/...`) → Lecture et téléchargement direct en MP4 HD.
4. **Instagram Carrousel** : Collez un post multi-images Instagram → Extraction des photos HD.
5. **Photo de Profil HD** : Tapez `@pseudo` ou collez un profil Instagram → Affichage et téléchargement de l'avatar 1080×1080.
