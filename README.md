# VIDNEX — Universal Media Downloader

Application web haute performance (React 18 + TypeScript + Vite + Tailwind CSS) propulsée par une architecture serverless **100 % gratuite** sur **Cloudflare Pages** et Edge Functions (`/functions/api`), avec un serveur de développement local Express (`server.ts` + `/server/api`).

---

## 🌟 Fonctionnalités Clés

- **100 % Gratuit & Sans Clé Payante** : Aucun abonnement RapidAPI, aucune carte bancaire requise et aucun conteneur Docker payant.
- **Moteur TikTok Direct** : Téléchargement Full HD 1080p sans filigrane, carrousels de photos haute résolution et extraction audio MP3.
- **Moteur Instagram Multi-Niveaux** :
  - **Niveau 1** : Analyse de l'embed officiel Instagram (`/p/{shortcode}/embed/captioned/`).
  - **Niveau 2** : Requêtes GraphQL anonymes avec l'en-tête officiel `X-IG-App-ID: 936619743392459` (carrousels et Reels).
  - **Niveau 3** : Moteur de secours multi-instances Cobalt libres et publiques (`api.cobalt.tools`, `capi.wuk.sh`, `cobalt.kwiatekm.tokyo`).
  - **Avatars HD** : Extraction des photos de profil 1080×1080 via OpenGraph.
- **Moteur X (Twitter)** : Prise en charge des vidéos et médias multiples via les moteurs ouverts BetterTwitFix / vxTwitter.
- **Téléchargement Forcé Mobile & Desktop** (`/api/download`) : Flux avec en-têtes `Content-Disposition: attachment; filename="..."` et contournement CORS pour sauvegarder directement sur smartphone ou ordinateur sans ouverture d'onglet parasite.
- **Design Moderne & Réactif** : Palette chaleureuse orange clair / pêche avec thème sombre / clair, tiroir de résultats interactif et conformité RGPD / conditions d'utilisation.

---

## 🏗️ Architecture du Projet

```text
VIDNEX/
├── functions/api/          # Fonctions Serverless Cloudflare Pages Edge (Production)
│   ├── extract.ts          # Moteur multi-plateformes (TikTok, Instagram, Twitter, Fallback)
│   └── download.ts         # Proxy de téléchargement forcé avec bypass CORS
├── server/api/             # API locales Express (Développement local)
│   ├── extract.ts          # Moteurs locaux avec parité exacte Cloudflare
│   ├── download.ts         # Proxy de téléchargement local
│   ├── _config.ts          # Utilitaires de configuration
│   └── _normalizer.ts      # Normalisation uniforme des charges utiles
├── src/                    # Frontend React 18 + Vite
│   ├── components/         # Header, HeroOmnibox, ResultDrawer, Footer, LegalModal
│   ├── services/           # extractorService.ts, adsenseService.ts
│   └── utils/              # Détecteur d'URL et helpers d'animation
├── server.ts               # Serveur Node.js / Express local (port 3000)
├── DEPLOY_FREE.md          # Guide pas-à-pas de déploiement Cloudflare Pages
└── package.json            # Scripts et dépendances
```

---

## 🚀 Démarrage Rapide

### 1. Prérequis
- Node.js 18+ ou 20+

### 2. Installation
```powershell
npm install
```

### 3. Lancer en Développement Local
```powershell
npm run dev
```
L'application démarre sur `http://localhost:3000`.

### 4. Compiler pour la Production
```powershell
npm run build
```
Les fichiers statiques optimisés sont générés dans le dossier `dist/`.

---

## 🌐 Déploiement Gratuit sur Cloudflare Pages

Le déploiement s'effectue en quelques clics via Git :
1. Créez un projet sur **[Cloudflare Pages](https://dash.cloudflare.com/)** lié à votre dépôt GitHub.
2. Définissez les réglages suivants :
   - **Framework preset** : `Vite`
   - **Build command** : `npm run build`
   - **Build output directory** : `dist`
3. Aucune variable d'environnement obligatoire n'est requise.
4. Cliquez sur **Save and Deploy**.

Consultez le guide complet et détaillé dans [DEPLOY_FREE.md](./DEPLOY_FREE.md).

---

## 📄 Licence
Projet open-source distribué sous licence MIT.
