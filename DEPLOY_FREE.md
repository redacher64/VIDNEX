# 🚀 Architecture & Déploiement Cloudflare — VIDNEX (Instagram & TikTok)

Ce projet fonctionne **100 % gratuitement sur Cloudflare Edge** sans base de données, sans serveur Python externe et sans clé API payante obligatoire.

---

## 📁 Structure Finale du Projet

```text
├── functions/                  # Backend Serverless Cloudflare Edge
│   ├── _lib/
│   │   ├── allowlist.ts        # Sécurité anti-SSRF stricte (CDNs officiels uniquement, blocage RFC 1918)
│   │   ├── detect.ts           # Détection d'URLs et @usernames (TikTok & Instagram)
│   │   ├── http.ts             # Client HTTP Edge avec suivi des cookies et User-Agent réalistes
│   │   ├── instagram.ts        # Moteur Instagram 3 niveaux (100 % Sans Compte : GraphQL + Embed + Passerelles)
│   │   ├── normalize.ts        # Schéma JSON unifié, codes HTTP réels (400/403/404/429/502/504) & Cache Edge
│   │   ├── rateLimit.ts        # Protection Token Bucket par IP (30 req/min extract, 60 req/min download)
│   │   └── tiktok.ts           # Moteur TikTok (API publique TikWM sans clé en dur + Fallback HTML direct)
│   └── api/
│       ├── extract.ts          # Endpoint GET/POST /api/extract
│       └── download.ts         # Proxy de streaming direct GET /api/download (redirect: 'manual', max 250 Mo)
├── public/
│   ├── .assetsignore           # Exclusion des règles conflictuelles Cloudflare Assets
│   ├── favicon.svg             # Icône vectorielle officielle VIDNEX
│   ├── robots.txt              # Directives d'indexation moteurs de recherche
│   └── sitemap.xml             # Plan de site XML multilingue (EN, FR, ES, PT, AR)
├── src/                        # Frontend React 18 + Tailwind CSS + Vite 6
│   ├── components/             # Header, HeroOmnibox, ResultDrawer, LegalModal, SeoSchemaInjector
│   ├── services/               # Client API extractorService.ts (erreurs traduites en 5 langues)
│   └── utils/                  # Détecteur d'URLs, Générateur d'archives PKZIP (.zip) & Suite de tests
├── tsconfig.json               # Configuration TypeScript globale
├── tsconfig.backend.json       # Configuration TypeScript dédiée au Worker et aux Functions
├── worker.ts                   # Point d'entrée unifié Cloudflare Workers + Static Assets
└── wrangler.jsonc              # Configuration officielle de déploiement Cloudflare (`npx wrangler deploy`)
```

---

## 🌐 Mode de Déploiement Unifié (`wrangler.jsonc`)

Le fichier `wrangler.jsonc` configure **Cloudflare Workers avec Static Assets** (et reste 100 % compatible avec Cloudflare Pages Functions) :
- **Commande de build** : `npm run build` (`tsc && vite build`)
- **Commande de déploiement** : `npx wrangler deploy`
- **Répertoire d'assets statiques** : `./dist` avec `single-page-application` activé (aucun fichier `_redirects` requis).
- **Routage Edge (`worker.ts`)** :
  - `GET / POST /api/extract` → `functions/api/extract.ts`
  - `GET / HEAD /api/download` → `functions/api/download.ts`
  - `GET /api/health` → État de santé des moteurs d'extraction
  - Toutes les autres routes → Assets statiques React (`env.ASSETS`)

---

## ⚙️ Architecture d'Extraction Sans Compte

### 1. Instagram (`functions/_lib/instagram.ts`) — 3 Niveaux Sans Compte
1. **Niveau 1 (GraphQL Public POST)** : Interroge `https://www.instagram.com/graphql/query` et `/api/graphql` avec les `doc_id` publics (`8845758582119845`, `10015901848480474`, `7950326061742207`) et `X-IG-App-ID: 936619743392459` pour extraire les vidéos HD, carrousels (`edge_sidecar_to_children`) et pistes audio.
2. **Niveau 2 (Embed Captioned amélioré)** : Analyse `/p/{shortcode}/embed/captioned/` (`window.__additionalDataLoaded`, `contextJSON` doublement échappé et balises OpenGraph).
3. **Niveau 3 (Passerelles publiques gratuites)** : En cas de blocage WAF sur l'IP Cloudflare, bascule automatiquement sur `api.vxinstagram.com` / `d.ddinstagram.com` sans nécessiter de compte.
4. *(Optionnel)* Si vous souhaitez extraire des Stories ou augmenter vos limites, vous pouvez définir le secret `IG_SESSION_ID` dans Cloudflare.

### 2. TikTok (`functions/_lib/tiktok.ts`) — Zéro Clé en Dur
1. **Niveau 1 (API publique TikWM)** : Appelle `https://www.tikwm.com/api/` sans clé codée en dur (ou utilise `env.TIKWM_API_KEY` si vous l'avez configurée dans Cloudflare) et normalise toutes les URLs relatives en URLs absolues.
2. **Niveau 2 (Réhydratation HTML directe)** : Analyse `__UNIVERSAL_DATA_FOR_REHYDRATION__` / `SIGI_STATE` et transmet les cookies de session (`tt_chain_token`, `ttwid`) au proxy `/api/download`.

---

## 🔒 Sécurité & Protection du Quota Gratuit

- **Protection Anti-SSRF (`functions/_lib/allowlist.ts` & `functions/api/download.ts`)** :
  - Autorise uniquement les sous-domaines CDN médias officiels (`*.cdninstagram.com`, `*.fbcdn.net`, `*.tiktokcdn.com`, `*.tiktokcdn-us.com`, `*.byteoversea.com`, `*.tikwm.com`, `v16-webapp-prime.tiktok.com`).
  - Rejette les domaines web nus (`instagram.com`, `facebook.com`, `tiktok.com`) et toutes les adresses IP privées RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `127.0.0.0/8`).
  - Suit les redirections manuellement (`redirect: 'manual'`, max 4 sauts) en revalidant chaque en-tête `Location`.
- **Rate Limiting & Cache Edge (`functions/_lib/rateLimit.ts`)** :
  - Limite chaque IP à **30 extractions/min** et **60 téléchargements/min** (`HTTP 429` + `Retry-After`).
  - Cache court Cloudflare (`Cache-Control: public, max-age=60, s-maxage=300`) sur `/api/extract`.
  - Plafond de **250 Mo** par fichier sur `/api/download` (`HTTP 413`).
