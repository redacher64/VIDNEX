# VIDNEX — Téléchargeur Média TikTok & Instagram 100 % Gratuit

Application web moderne (React 18 + TypeScript + Vite + Tailwind CSS) déployée sur **Cloudflare Pages** avec **Pages Functions** (`functions/`).

---

## 🌟 Caractéristiques Principales

- **100 % Gratuit & Zéro API Tierce** : Aucun abonnement RapidAPI, aucun service Cobalt, aucun proxy externe payant.
- **Moteur TikTok Direct** :
  - Résolution automatique des liens courts (`vm.tiktok.com`, `vt.tiktok.com`).
  - Scraping direct du JSON officiel TikTok (`__UNIVERSAL_DATA_FOR_REHYDRATION__`).
  - Téléchargement du flux HD 1080p source sans filigrane, carrousels de photos et audio MP3.
- **Moteur Instagram à Deux Niveaux** :
  - **Niveau 1 (Sans compte)** : Analyse de la page embed officielle `/p/{shortcode}/embed/captioned/` pour extraire vidéos et images publiques.
  - **Niveau 2 (Optionnel)** : Prise en charge du secret `IG_SESSION_ID` (Cloudflare Pages) pour les contenus restreints.
  - Rapports d'erreur transparents et précis (codes d'erreur explicites).
- **Proxy de Téléchargement Sécurisé en Streaming (`/api/download`)** :
  - Allowlist stricte (domaines CDN TikTok et Meta/Instagram uniquement, rejet 403 de tout autre domaine).
  - Streaming direct sans mise en mémoire tampon (Zero-buffering).
  - Gestion des en-têtes `Range` (iOS/Safari/Chrome) et forçage du téléchargement avec `Content-Disposition: attachment`.

---

## 🏗️ Structure du Projet

```text
VIDNEX/
├── functions/               # Fonctions Edge Cloudflare Pages
│   ├── api/
│   │   ├── extract.ts       # GET /api/extract?url=...
│   │   └── download.ts      # GET /api/download?url=...&filename=...
│   └── _lib/                # Modules partagés (non routés)
│       ├── allowlist.ts     # Domaines CDN autorisés (sécurité anti-SSRF)
│       ├── detect.ts        # Détection et validation d'URLs
│       ├── http.ts          # Client HTTP (User-Agent réaliste, cookies, timeouts)
│       ├── instagram.ts     # Moteur Instagram direct (Niveaux 1 et 2)
│       ├── normalize.ts     # Format de réponse unifié et codes d'erreur
│       └── tiktok.ts        # Moteur TikTok direct sans filigrane
├── public/                  # Fichiers statiques et échantillons de test
├── src/                     # Interface React 18 + Tailwind
│   ├── components/          # Composants UI
│   ├── services/            # extractorService.ts
│   └── utils/               # Détecteur d'URLs côté client
├── package.json             # Scripts et dépendances minimales
├── wrangler.jsonc           # Configuration Cloudflare Pages
└── vite.config.ts           # Configuration Vite
```

---

## 🚀 Développement Local

### 1. Installation des dépendances
```bash
npm install
```

### 2. Démarrage du serveur de développement (Vite)
```bash
npm run dev
```

### 3. Tester localement avec les Cloudflare Pages Functions
```bash
npm run dev:cf
```

### 4. Compiler pour la production
```bash
npm run build
```

---

## 🌐 Déploiement sur Cloudflare Pages

1. Connectez votre dépôt GitHub à **Cloudflare Pages**.
2. Paramètres de compilation :
   - **Framework preset** : `Vite`
   - **Build command** : `npm run build`
   - **Build output directory** : `dist`
3. Variables d'environnement (optionnel) :
   - `IG_SESSION_ID` : votre sessionid Instagram si vous souhaitez activer le Niveau 2 authentifié.
4. Cliquez sur **Save and Deploy**.
