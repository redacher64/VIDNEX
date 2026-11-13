# VIDNEX — Documentation Technique Complète

**VIDNEX** (`https://vidnex.space`) est une application web multilingue (10 langues) et prérendue statiquement permettant de télécharger des médias publics depuis **TikTok**, **Instagram**, **X (Twitter)**, **Facebook** et **LinkedIn**, propulsée par **React 19**, **TypeScript**, **Vite 6**, **Tailwind CSS 4**, **Cloudflare Pages Functions / Workers** et **Cloudflare D1**.

> **Règle de sécurité** : Ce fichier ne contient aucun secret, mot de passe, cookie de session ni clé d'API. Seuls les **noms** des variables d'environnement et des secrets sont documentés (voir [Section 9](#9-variables-et-secrets)).

---

## Table des matières

1. [Présentation et plateformes](#1-présentation-et-plateformes)
2. [Stack et architecture](#2-stack-et-architecture)
3. [Arborescence commentée](#3-arborescence-commentée)
4. [Fonctionnement par plateforme](#4-fonctionnement-par-plateforme)
5. [Internationalisation (i18n)](#5-internationalisation-i18n)
6. [Référencement naturel (SEO) et Performance](#6-référencement-naturel-seo-et-performance)
7. [Panneau d'administration (`/admin`)](#7-panneau-dadministration-admin)
8. [Déploiement Cloudflare Pages & Workers](#8-déploiement-cloudflare-pages--workers)
9. [Variables et secrets](#9-variables-et-secrets)
10. [Développement local et scripts npm](#10-développement-local-et-scripts-npm)
11. [Scripts de vérification et tests](#11-scripts-de-vérification-et-tests)
12. [Travail à deux (Git, branches, Pull Requests)](#12-travail-à-deux-git-branches-pull-requests)
13. [Limites connues et dépannage](#13-limites-connues-et-dépannage)
14. [Pistes à venir](#14-pistes-à-venir)
15. [Blog](#15-blog)
16. [Services tiers](#16-services-tiers)

---

## 1. Présentation et plateformes

VIDNEX permet d'extraire et de télécharger **exclusivement des contenus publics**, sans création de compte utilisateur sur le site et sans filigrane ajouté. L'ordre canonique des 5 plateformes dans le code (`PLATFORM_PAGE_KEYS` dans `src/i18n/config.ts` et `Platform` dans `functions/_lib/normalize.ts`) est :

| Plateforme (`Platform`) | Contenus publics pris en charge | Formats de sortie | Limites / exclusions explicites |
| :--- | :--- | :--- | :--- |
| **TikTok** (`tiktok`) | Vidéos publiques (`/@user/video/{id}`, `vm.tiktok.com`, `vt.tiktok.com`, `/t/`), carrousels photos (Photo Mode) et photos de profil publiques (`/@username`) | Vidéo `MP4` (1080p HD / 720p sans filigrane), Images `JPG`, Audio original `MP3` ou `M4A` | Comptes privés, vidéos supprimées ou soumises à un captcha WAF |
| **Instagram** (`instagram`) | Reels (`/reel/{code}`, `/reels/{code}`), publications photos/vidéos et carrousels multi-slides (`/p/{code}`), IGTV (`/tv/{code}`), Stories (`/stories/{user}/{id}`) et photos de profil (`/@username` ou `instagram.com/{username}`) | Vidéo `MP4`, Images `JPG`, Audio `MP3` | Comptes privés sans photo publique, contenus restreints nécessitant une session si aucune session n'est configurée |
| **X / Twitter** (`x`) | Tweets publics contenant une vidéo, un GIF animé ou une à plusieurs photos (`x.com/{user}/status/{id}`, `twitter.com/...`, liens courts `t.co/{code}`) | Vidéo `MP4` (triée par bitrate décroissant : 1080p, 720p, etc.), Images `JPG`/`PNG` (`name=orig`) | Comptes protégés, tweets supprimés, contenus restreints par l'âge (`NsfwViewerIsLoggedOut`) ou tweets purement textuels (`NO_MEDIA`) |
| **Facebook** (`facebook`) | Vidéos publiques et Reels publics (`facebook.com/watch/?v={id}`, `/reel/{id}`, `/videos/{id}`, `/share/v/{code}`, `/share/r/{code}`, `fb.watch/{code}`) | Vidéo `MP4` (`HD` et `SD` avec dédoublonnage automatique si identiques) | Groupes privés, vidéos réservées aux amis, vidéos protégées par un mur de connexion (`/login`) ou checkpoint |
| **LinkedIn** (`linkedin`) | **Uniquement la photo de profil publique** des profils personnels (`linkedin.com/in/{slug}`, avec `www.` ou sous-domaine de pays comme `fr.linkedin.com`) | Image `JPG` (`linkedin_{slug}_profile.jpg`) | Pages entreprises (`/company/`), publications (`/posts/`, `/feed/`), offres (`/jobs/`), profils privés, avatars par défaut (« ghost ») et murs de connexion (`/authwall`, statut HTTP `999`) |

---

## 2. Stack et architecture

### Stack technique
- **Frontend** : React `19.2`, TypeScript `5.8`, Vite `6.2`, Tailwind CSS `4.1` (`@tailwindcss/vite`).
- **Icônes & Graphiques** : `lucide-react` (interface publique) et `recharts` (chargé uniquement en *lazy-loading* dans le bundle `/admin`).
- **Backend Edge** : Cloudflare Pages Functions (`functions/`) et point d'entrée unifié Cloudflare Workers Static Assets (`worker.ts`).
- **Base de données Edge** : Cloudflare D1 (SQLite distribué, binding `DB`, base `vidnex-db`).
- **Serveur de développement local** : `server.ts` (Express + middleware Vite sur le port `3000` montent les mêmes handlers `functions/api/*` qu'en production).
- **Prérendu statique & OG** : Scripts Node.js ESM (`scripts/prerender.mjs`, `scripts/generate-og.mjs` avec `sharp` / `resvg`).

### Schéma ASCII du flux d'extraction et de téléchargement

```text
+-----------------------------------------------------------------------------------+
|                                NAVIGATEUR CLIENT                                  |
|  1. Saisie URL -> src/utils/urlDetector.ts (validation rapide côté client)        |
|  2. POST /api/extract  {"url": "..."}                                             |
|  3. Affichage aperçu + clic "Télécharger" -> GET /api/download?url=...&filename=  |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                   CLOUDFLARE EDGE (worker.ts / functions/)                        |
|  _middleware.ts : Redirection 301 www.vidnex.space -> vidnex.space                |
|                   En-tête X-Robots-Tag: noindex sur *.pages.dev / *.workers.dev   |
+-----------------------------------------+-----------------------------------------+
                                          |
                  +-----------------------+-----------------------+
                  |                                               |
                  v                                               v
+-----------------------------------+           +-----------------------------------+
|         POST /api/extract         |           |         GET /api/download         |
| (functions/api/extract.ts)        |           | (functions/api/download.ts)       |
+-----------------+-----------------+           +-----------------+-----------------+
                  |                                               |
  1. Lecture settings D1 (maintenance,            1. Limite de débit D1 par IP hachée
     platform_*, rate_limit_per_min)                 (download_limit_per_min = 60, 1x par
  2. Hachage IP (SHA-256 + IP_HASH_SALT)             fichier et par minute, Range compris)
  3. Vérification blocklist D1                    2. Validation HTTPS + isAllowedMediaHost
     (ip_hash, domain, url)                          (allowlist.ts : anti-SSRF strict)
  4. Vérification rate_limits D1                  3. Fetch stream CDN amont + Auto-Heal
     (repli Token Bucket mémoire si D1 off)       4. Streaming direct (TransformStream) :
  5. Détection & normalisation d'URL                 download_started -> download_success
     (functions/_lib/detect.ts)                      (si flux terminé sans erreur serveur)
                  |                                               |
                  v                                               |
+-----------------------------------+                             |
|       MOTEURS D'EXTRACTION        |                             |
|  - _lib/tiktok.ts                 |                             |
|  - _lib/instagram.ts              |                             |
|  - _lib/x.ts                      |                             |
|  - _lib/facebook.ts               |                             |
|  - _lib/linkedin.ts               |                             |
+-----------------+-----------------+                             |
                  |                                               |
                  +-----------------------+-----------------------+
                                          |
                                          |  ctx.waitUntil(...) — Non bloquant
                                          v
+-----------------------------------------------------------------------------------+
|                 BASE DE DONNÉES CLOUDFLARE D1 (DB) & ALERTES                      |
|  - daily_metrics : compteurs agrégés par jour, plateforme et événement            |
|                    (extract_started, extract_success, extract_error,              |
|                     download_started, download_success) — 0 identifiant personnel |
|  - request_log   : détail UNIQUEMENT pour les erreurs (content_kind, engine_fn,   |
|                    engine_stage, http_status, error_code, duration_ms, ip_hash    |
|                    salée tronquée 30j) — aucune URL ni IP en clair stockée        |
|  - engine_status : santé des 6 moteurs + consecutive_failures + alert_sent        |
|                    -> 5 échecs consécutifs : 1 alerte via ALERT_WEBHOOK_URL       |
|                    -> succès suivant : 1 alerte de retour à la normale            |
|  - settings      : configuration dynamique (rate_limit_per_min,                   |
|                    download_limit_per_min, maintenance, plateformes, pub, URLs)   |
|  - rate_limits   : compteurs de débit par IP hachée et fenêtre d'une minute       |
|  - blocklist     : blocage par ip_hash, domain ou url                             |
|  - login_attempts: protection anti-brute-force de la connexion /admin             |
+-----------------------------------------------------------------------------------+
```

---

## 3. Arborescence commentée

```text
/
├── .env.example                 # Modèle des variables d'environnement (noms uniquement, aucun secret)
├── index.html                   # Template HTML principal (point d'entrée Vite et base du prérendu)
├── metadata.json                # Métadonnées de l'application AI Studio
├── package.json                 # Dépendances et scripts npm (dev, build, lint, test, indexnow)
├── server.ts                    # Serveur Express + Vite pour le développement local (port 3000)
├── tsconfig.json                # Configuration TypeScript globale
├── tsconfig.backend.json        # Configuration TypeScript stricte pour functions/ et worker.ts
├── vite.config.ts               # Configuration Vite (Tailwind CSS 4, découpage manuel chunk admin)
├── worker.ts                    # Point d'entrée Cloudflare Workers (route /api/*, sert 404.html avec HTTP 404)
├── wrangler.jsonc               # Configuration Cloudflare (binding ASSETS, binding D1 vidnex-db)
│
├── functions/                   # Backend Cloudflare Pages Functions
│   ├── _middleware.ts           # Redirection 301 www -> apex + X-Robots-Tag noindex sur domaines d'aperçu
│   ├── _lib/                    # Bibliothèques partagées côté serveur
│   │   ├── allowlist.ts         # Liste blanche stricte des CDN médias autorisés (anti-SSRF)
│   │   ├── auth.ts              # Authentification admin (SHA-256 constant-time, cookie HMAC-SHA256, CSRF, brute-force)
│   │   ├── cors.ts              # Gestion des en-têtes CORS pour /api/*
│   │   ├── db.ts                # Accès sécurisé à Cloudflare D1, hachage IP SHA-256, daily_metrics et engine_status
│   │   ├── detect.ts            # Détection, validation et normalisation d'URL pour les 5 plateformes
│   │   ├── facebook.ts          # Moteur d'extraction Facebook (desktop, mobile m.facebook.com, plugin embed)
│   │   ├── http.ts              # Client HTTP avec AbortController, timeout et collecte de cookies Set-Cookie
│   │   ├── instagram.ts         # Moteur d'extraction Instagram (publications, Reels, Stories et profils)
│   │   ├── linkedin.ts          # Moteur d'extraction LinkedIn (photo de profil publique via og:image / JSON-LD)
│   │   ├── logger.ts            # Compteurs daily_metrics, journal d'erreurs request_log et alertes ALERT_WEBHOOK_URL
│   │   ├── normalize.ts         # Types partagés (Platform, ErrorCode, ExtractResponse, STATUTS HTTP)
│   │   ├── ratelimit.ts         # Limitation de débit D1 (/api/extract et /api/download) + repli mémoire Token Bucket
│   │   ├── settings.ts          # Lecture/écriture de la table settings et vérification de la blocklist
│   │   ├── tiktok.ts            # Moteur d'extraction TikTok (API TikWM + scraping page officielle + audio)
│   │   └── x.ts                 # Moteur d'extraction X / Twitter (cdn.syndication.twimg.com + résolution t.co)
│   └── api/                     # Endpoints HTTP exposés sous /api/*
│       ├── public-config.ts     # GET /api/public-config : état public (maintenance, plateformes actives, ads_enabled)
│       ├── download.ts          # GET/HEAD /api/download : proxy de streaming média sécurisé + rate-limit + Auto-Heal
│       ├── extract.ts           # POST/GET /api/extract : point d'entrée principal d'extraction média
│       └── admin/               # Endpoints protégés d'administration (/api/admin/*)
│           ├── activity.ts      # GET /api/admin/activity : consultation paginée du journal des erreurs
│           ├── blocklist.ts     # GET/POST/DELETE /api/admin/blocklist : gestion des règles de blocage
│           ├── health.ts        # GET/POST /api/admin/health : état des moteurs et tests en direct
│           ├── login.ts         # GET/POST /api/admin/login : vérification de session et connexion admin
│           ├── logout.ts        # POST /api/admin/logout : révocation immédiate du cookie de session
│           ├── settings.ts      # GET/POST /api/admin/settings : modification des réglages système D1
│           └── stats.ts         # GET /api/admin/stats : entonnoir extraction->téléchargement et taux par plateforme
│
├── migrations/                  # Migrations SQL pour Cloudflare D1
│   ├── 0001_init.sql            # Tables initiales (request_log, settings, rate_limits, blocklist, engine_status, login_attempts)
│   ├── 0002_add_engine_stage_http_status.sql # Ajout de engine_stage, http_status et test_url_instagram_profile
│   ├── 0003_add_linkedin.sql    # Ajout de platform_linkedin, test_url_linkedin et engine_status linkedin
│   ├── 0004_metrics_and_alerts.sql # Ajout de daily_metrics, download_limit_per_min, consecutive_failures et alert_sent
│   └── 0005_activity_content_kind_engine_fn.sql # Ajout non destructif de content_kind et engine_fn à request_log
│
├── public/                      # Fichiers statiques copiés à la racine de dist/
│   ├── _headers                 # En-têtes Cloudflare Pages (CSP, HSTS, X-Frame-Options, cache long pour assets)
│   ├── 4df937b019694aa285d6c53683447329.txt # Clé de vérification IndexNow (Bing / Yandex)
│   ├── ads.txt                  # Déclaration publicitaire Google AdSense
│   ├── favicon.svg              # Icône vectorielle VIDNEX
│   ├── llms.txt                 # Fichier descriptif structuré pour les moteurs IA
│   ├── manifest.webmanifest     # Manifeste Web App
│   ├── robots.txt               # Règles d'exploration (Autorise /, bloque /admin et /api/)
│   ├── sitemap.xml              # Sitemap XML généré avec balises xhtml:link hreflang pour les 75 routes
│   └── og/                      # Images OpenGraph 1200x630 JPG (avec noms hashés anti-cache)
│
├── scripts/                     # Scripts de build, SEO et maintenance
│   ├── check-og.mjs             # Vérifie la présence, les dimensions (1200x630) et le poids (<300 Ko) des images OG
│   ├── generate-og.mjs          # Génère les images OpenGraph dans public/og/ + manifest.json
│   ├── indexnow.mjs             # Soumet les URLs du sitemap.xml à l'API IndexNow
│   ├── prerender.mjs            # Prérend statiquement les 75 routes publiques + 404.html après vite build
│   ├── update-locales-linkedin.mjs # Utilitaire de mise à jour des traductions LinkedIn dans les 10 langues
│   └── verify-seo.mjs           # Audit automatisé des 75 fichiers HTML générés dans dist/
│
├── src/                         # Code source Frontend React + TypeScript
│   ├── App.tsx                  # Composant racine public (routage multilingue, outil d'extraction, FAQ, SEO)
│   ├── main.tsx                 # Point d'entrée React (charge AdminApp en lazy-loading uniquement sur /admin)
│   ├── index.css                # Styles globaux Tailwind CSS 4 et variables de thème (clair/sombre)
│   ├── components/              # Composants d'interface réutilisables
│   │   ├── AdSlot.tsx           # Emplacement publicitaire conditionnel (masqué si pas d'ID AdSense ou ads_enabled=false)
│   │   ├── AmbientBackground.tsx# Arrière-plan visuel léger
│   │   ├── DownloadButton.tsx   # Bouton de téléchargement avec barre de progression XHR et gestion d'erreurs
│   │   ├── EditorialContent.tsx # Contenu éditorial riche sous la ligne de flottaison (accueil & pages plateformes)
│   │   ├── Footer.tsx           # Pied de page multilingue (liens plateformes filtrés selon réglages + liens légaux)
│   │   ├── LegalPagesContent.tsx# Contenu des 5 pages légales (À propos, Confidentialité, Conditions, Contact, DMCA)
│   │   ├── MediaPreviewModal.tsx# Modale de prévisualisation vidéo/image/audio
│   │   ├── PlatformIcons.tsx    # Icônes SVG vectorielles des 5 plateformes (TikTok, Instagram, X, Facebook, LinkedIn)
│   │   ├── ResultCard.tsx       # Carte de résultat d'extraction (miniature, auteur, sélecteur de qualité, carrousel)
│   │   └── SeoHead.tsx          # Synchronisation dynamique du <head> lors de la navigation SPA
│   ├── i18n/                    # Système d'internationalisation (10 langues)
│   │   ├── config.ts            # Configuration des langues, table des slugs localisés et résolveur de routes
│   │   ├── index.ts             # Hook et utilitaires de traduction
│   │   ├── legalExtra.ts        # Traductions complémentaires des pages légales (fr, en, ar)
│   │   └── locales/             # Dictionnaires de traduction complets (fr, en, ar, es, pt, de, tr, id, it, ru)
│   ├── pages/admin/             # Interface d'administration (/admin) isolée du bundle public
│   │   ├── AdminApp.tsx         # Layout et navigation par onglets de l'admin
│   │   ├── Login.tsx            # Écran de connexion administrateur
│   │   ├── Dashboard.tsx        # Vue d'ensemble analytique (KPIs, graphiques 24h/7j/30j)
│   │   ├── Health.tsx           # État des 6 moteurs et testeur d'extraction en direct
│   │   ├── Controls.tsx         # Interrupteurs (maintenance, 5 plateformes, pubs, rate-limit, blocklist)
│   │   ├── Activity.tsx         # Journal détaillé des requêtes avec filtres, export CSV et purge
│   │   ├── AdminIcons.tsx       # Icônes dédiées à l'interface admin
│   │   └── healthConfig.ts      # Configuration d'affichage des moteurs dans l'onglet Santé
│   ├── services/
│   │   └── extractorService.ts  # Client HTTP frontend appelant /api/extract et construisant les liens /api/download
│   └── utils/
│       ├── urlDetector.ts       # Détection et validation d'URL côté client (miroir de functions/_lib/detect.ts)
│       └── urlDetector.test.ts  # Suite de tests unitaires du détecteur d'URL
│
└── tests/                       # Tests unitaires backend
    └── linkedin.test.ts         # Tests unitaires de détection, parsing HTML et allowlist LinkedIn
```

---

## 4. Fonctionnement par plateforme

### 4.1 Niveaux de repli (Fallback Levels) par moteur

#### TikTok (`functions/_lib/tiktok.ts`)
- **Cas Profil (`/@username`)** :
  1. Appelle `https://www.tikwm.com/api/user/info?unique_id={handle}` (avec `TIKWM_API_KEY` si définie, sinon sans clé) pour obtenir l'avatar HD (`avatarLarger`).
  2. En cas d'échec, bascule sur le scraping direct de la page `https://www.tiktok.com/@{handle}` et extrait `webapp.user-detail.userInfo` depuis `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">`.
- **Cas Vidéo / Carrousel Photo** :
  - **Niveau 1** : Interroge en parallèle l'API publique `https://www.tikwm.com/api/` (avec réessai automatique après `1050 ms` si limite gratuite `1 req/s`) et récupère la page officielle TikTok pour extraire l'URL audio authentique (`itemStruct.music`) et les cookies de session (`tt_chain_token`, `ttwid`). Vérifie le type réel de l'audio (`mp3` ou `m4a`) via une requête `HEAD` (`detectTikTokAudioExt`).
  - **Niveau 2 (Repli direct)** : Si TikWM échoue, parse directement le HTML de la page TikTok (`__UNIVERSAL_DATA_FOR_REHYDRATION__`, `SIGI_STATE`, ou `__NEXT_DATA__`), extrait `playAddr` / `downloadAddr` / `bitrateInfo` (ou `imagePost.images` pour les carrousels) et transmet les cookies de session au proxy `/api/download`.

#### Instagram (`functions/_lib/instagram.ts`)
- **Détection prioritaire Stories & Highlights (`functions/_lib/detect.ts`)** : `/stories/highlights/{id}/` est classé `highlight` et `/stories/{username}/{id}/` est classé `story` **avant** toute règle Reels/Post (y compris après redirection d'un lien court `/share/...`). Aucun lien `/stories/` n'est jamais classé `reel` ni envoyé au moteur Reels.
- **Cas Stories & Highlights (`kind = 'story' | 'highlight'`)** :
  - Si `env.IG_SESSION_ID` est défini, interroge exclusivement le moteur story authentifié (`/api/v1/media/{mediaId}/info/` et `/api/v1/feed/reels_media/`).
  - Si `env.IG_SESSION_ID` est absent, renvoie immédiatement `PRIVATE_OR_LOGIN_REQUIRED` (`403`) avec le message explicite (« Les stories Instagram exigent une connexion : elles ne peuvent pas être téléchargées sans compte. », traduit dans les 10 langues) et journalise `content_kind = "story"` ou `"highlight"` dans `request_log`.
- **Cas Publications, Reels et Carrousels (`extractInstagram`)** :
  - **Niveau 0 (Session authentifiée optionnelle)** : Si `IG_COOKIES` ou `IG_SESSION_ID` est configuré, convertit le `shortcode` en `media_id` numérique (`shortcodeToMediaId`) et interroge `https://www.instagram.com/api/v1/media/{mediaId}/info/`.
  - **Niveau 1 (GraphQL)** : Requêtes `POST` sur `https://www.instagram.com/graphql/query` et `https://www.instagram.com/api/graphql` avec les `doc_id` publics (`8845758582119845`, `10015901848480474`, `7950326061742207`).
  - **Niveau 2 (Embed Captioned + OpenGraph)** : Analyse `https://www.instagram.com/p/{shortcode}/embed/captioned/` (`window.__additionalDataLoaded`, `contextJSON`, `video_url`, `display_url`), puis les balises meta OpenGraph de la page publique.
  - **Niveau 3 (Passerelles publiques sans clé)** : Repli sur `https://api.vxinstagram.com/p/{shortcode}` et `https://d.ddinstagram.com/p/{shortcode}` si l'IP Cloudflare est filtrée par Instagram.
- **Cas Photo de Profil (`extractInstagramProfile` — `engineKey: instagram_profile`)** :
  - **Niveau 1 (`level1_web_profile_info`)** : Requête sans compte vers `GET /api/v1/users/web_profile_info/?username={username}` avec `X-IG-App-ID: 936619743392459` et `redirect: 'manual'`.
  - **Niveau 2 (`level2_session_cookie`)** : Si le Niveau 1 échoue et que `IG_SESSION_ID` / `IG_COOKIES` est défini, retente `web_profile_info` avec le cookie de session (sans jamais l'exposer au client ni dans les logs).
  - **Niveau 3 (`level3_public_page` / `level3_embed_page`)** : Repli sur la page publique `https://www.instagram.com/{username}/` puis `https://www.instagram.com/{username}/embed/` (qualité `"Standard"` indiquée).
  - **Règle stricte anti-faux `NOT_FOUND`** : `NOT_FOUND` n'est renvoyé que si **deux sources indépendantes** confirment l'inexistence du profil. Un blocage login ou un statut `401/403/429` renvoie `BLOCKED_BY_PLATFORM`.

#### X / Twitter (`functions/_lib/x.ts`)
- **Résolution préalable des liens courts** : Si l'URL est un lien `https://t.co/{code}`, `resolveTcoShortLink` suit manuellement jusqu'à 3 redirections (en-tête `Location` ou `<meta http-equiv="refresh">`, timeout `4 s`) et revalide l'URL finale.
- **Source unique sans clé** : Calcule le jeton de syndication `computeSyndicationToken(tweetId)` (`((Number(ID) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '')`) et interroge :
  `GET https://cdn.syndication.twimg.com/tweet-result?id={ID}&token={TOKEN}&lang=en` (timeout `8 s`).
- Filtre les flux `video/mp4` (ignore `.m3u8`), trie les variantes par `bitrate` décroissant et force `?name=orig` sur les photos.

#### Facebook (`functions/_lib/facebook.ts`)
- **Détection prioritaire des Stories (`content_kind = "story"`)** : Les liens `/stories/...`, `/story.php?story_fbid=...`, `/share/s/...` et les liens courts (`fb.watch`, `/share/r/`, `/share/v/`) qui redirigent vers `/stories/` (ou `/login?next=/stories/...`) sont classés `story` **avant** les Reels et renvoient immédiatement `PRIVATE_OR_LOGIN_REQUIRED` (`403`) avec le message explicite (« Les stories Facebook exigent une connexion : elles ne peuvent pas être téléchargées sans compte. ») sans jamais appeler le moteur Reels ni contourner un mur de connexion.
- **Résolution préalable des liens de partage** : Si l'URL est un lien court (`fb.watch/{code}`, `/share/v/{code}`, `/share/r/{code}`), `resolveFacebookRedirect` suit manuellement jusqu'à 4 redirections avec vérification anti-SSRF stricte à chaque saut (`isAllowedFacebookHost`) puis reclasse l'URL finale.
- **Niveau 1 (Desktop)** : Récupère `https://www.facebook.com/...` et `https://www.facebook.com/watch/?v={id}` (timeout `8 s`), décode les séquences JSON/HTML échappées et extrait les flux `HD` (`browser_native_hd_url`, `playable_url_quality_hd`, `hd_src_no_ratelimit`, `hd_src`) et `SD` (`browser_native_sd_url`, `playable_url`, `sd_src_no_ratelimit`, `sd_src`, `og:video`).
- **Niveau 2 (Mobile & Plugin Embed)** : En cas d'échec du Niveau 1, bascule sur `https://m.facebook.com/watch/?v={id}` puis sur `https://www.facebook.com/plugins/video.php?href=...`. Détecte le faux flux « Discover Popular Videos » pour ne jamais renvoyer une vidéo aléatoire lorsqu'une vidéo a été supprimée.

#### LinkedIn (`functions/_lib/linkedin.ts`)
- **Validation stricte** : Accepte uniquement `linkedin.com/in/{slug}` (avec `www.` ou sous-domaine de pays de 2 lettres, ex. `fr.linkedin.com`). Rejette immédiatement (`/company/`, `/posts/`, `/feed/`, `/jobs/`, `/school/`, `/pub/`) avec `UNSUPPORTED_URL`.
- **Extraction sans compte** : Effectue un `GET https://www.linkedin.com/in/{slug}` avec `redirect: 'manual'` et timeout de `8 s` (suit au maximum 1 redirection canonique restant sous `/in/`).
- Lit l'URL de la photo dans `<meta property="og:image">` (ou `itemprop="image"`), ou en repli dans le bloc `<script type="application/ld+json">` (`Person` / `ProfilePage` -> `image`).
- Conserve l'URL signée (`media.licdn.com`) intacte, ignore toute autre donnée personnelle (`title = "@{slug}"`), et rejette les avatars par défaut (« ghost-person », `static.licdn.com`) avec `PRIVATE_OR_LOGIN_REQUIRED`.

---

### 4.2 Codes d'erreur et statuts HTTP (`functions/_lib/normalize.ts`)

| Code d'erreur (`ErrorCode`) | Statut HTTP (`ERROR_CODE_STATUS`) | Signification |
| :--- | :---: | :--- |
| `UNSUPPORTED_URL` | `400` | URL manquante, malformée, domaine non supporté ou format de lien non pris en charge (ex. page entreprise LinkedIn). |
| `PRIVATE_OR_LOGIN_REQUIRED` | `403` | Contenu privé, compte protégé, restriction d'âge ou photo de profil absente. |
| `PLATFORM_DISABLED` | `403` | La plateforme cible a été temporairement désactivée par l'administrateur dans D1 (`settings`). |
| `BLOCKED` | `403` | L'adresse IP hachée, le domaine ou l'URL figure dans la table `blocklist`. |
| `NOT_FOUND` | `404` | Publication ou profil confirmé comme supprimé ou inexistant. |
| `NO_MEDIA` | `422` | La publication existe mais ne contient aucun média téléchargeable (ex. tweet purement textuel). |
| `RATE_LIMITED` | `429` | Limite de requêtes par minute dépassée pour cette IP hachée (en-tête `Retry-After` inclus). |
| `BLOCKED_BY_PLATFORM` | `502` | La plateforme source (TikTok WAF, Instagram login wall, Facebook checkpoint, LinkedIn HTTP 999/authwall) bloque temporairement la requête depuis l'IP serveur. |
| `MAINTENANCE` | `503` | Le mode maintenance global est activé dans les paramètres administrateur. |
| `TIMEOUT` | `504` | Le délai maximum d'attente (`8 s` à `9 s`) a expiré lors de l'appel à la plateforme source. |

---

### 4.3 Format de réponse de `/api/extract`

Toutes les réponses de `/api/extract` respectent l'interface `ExtractResponse` (`functions/_lib/normalize.ts`) :

```json
{
  "ok": true,
  "id": "7381234567890123456",
  "platform": "tiktok",
  "type": "video",
  "title": "Titre ou description de la publication",
  "author": {
    "username": "createur",
    "nickname": "Nom Affiché",
    "avatar": "https://...",
    "verified": true
  },
  "thumbnail": "https://...",
  "duration": "00:42",
  "items": [
    {
      "kind": "video",
      "url": "https://...",
      "quality": "1080p",
      "ext": "mp4",
      "size": "14.2 MB"
    },
    {
      "kind": "audio",
      "url": "https://...",
      "quality": "Audio",
      "ext": "m4a"
    }
  ]
}
```
> **Note de sécurité** : Avant d'envoyer la réponse JSON au navigateur, `functions/api/extract.ts` supprime systématiquement toute propriété interne `cookie` afin qu'aucun cookie de session serveur ne fuite côté client.

---

### 4.4 Proxy de téléchargement (`/api/download`) et Allowlist anti-SSRF

Le fichier `functions/api/download.ts` agit comme un proxy de streaming direct (`ReadableStream` / `TransformStream`) entre les CDN des plateformes et le navigateur de l'utilisateur :
1. **Limite de débit par IP hachée (`checkD1DownloadRateLimit`)** :
   - Utilise le limiteur existant (`rate_limits` D1 avec repli mémoire Token Bucket) sur l'empreinte SHA-256 salée de l'IP (`dl:{ip_hash}`).
   - Réglage administrateur dynamique : `download_limit_per_min` (défaut : **60 fichiers / minute**).
   - **Déduplication par fichier et par minute** : les requêtes multiples pour un même fichier dans la même minute — y compris les requêtes HTTP `Range` — ne sont comptabilisées qu'**une seule fois**.
   - En cas de dépassement, renvoie `HTTP 429` avec l'en-tête `Retry-After`.
2. **Allowlist stricte (`functions/_lib/allowlist.ts`)** :
   - Seul le protocole `https:` est accepté.
   - Les adresses IP littérales (IPv4/IPv6), `localhost`, `.local`, `.internal` et `.oko.local` sont rejetés.
   - Seuls les hôtes CDN officiels explicitement listés dans `EXACT_HOSTS` ou `SUFFIX_HOSTS` sont autorisés :
     - **TikTok** : `tikwm.com`, `*.tiktokcdn.com`, `*.tiktokcdn-us.com`, `*.tiktokcdn-eu.com`, `*.tiktokv.com`, `*.byteoversea.com`, `*.ibytedtos.com`, `*.ibyteimg.com`, `*.Bytecdn.cn`, `*.musical.ly`, `*.akamaized.net`.
     - **Instagram & Facebook** : `*.cdninstagram.com`, `*.fbcdn.net`, `*.instagram.com`, `vxinstagram.com`, `ddinstagram.com`.
     - **X / Twitter** : `video.twimg.com`, `pbs.twimg.com`, `abs.twimg.com`, `ton.twimg.com`.
     - **LinkedIn** : `media.licdn.com`, `*.media.licdn.com` (le domaine d'assets statiques `static.licdn.com` est volontairement exclu).
3. **En-têtes et Cookies de session** : Ajoute automatiquement les en-têtes `Referer` et `Origin` requis par chaque CDN et supporte l'en-tête `Range` pour la reprise de téléchargement.
4. **Auto-Heal** : Si un lien média signé a expiré (`403`, `401`, `410`) et que le paramètre `src` est fourni, `/api/download` relance le moteur correspondant à la volée pour récupérer une nouvelle URL CDN fraîche.
5. **Limite de taille** : Rejette avec `413 Payload Too Large` tout fichier dépassant **250 Mo** (`MAX_CONTENT_LENGTH_BYTES = 250 * 1024 * 1024`).
6. **Mesure de bout en bout du flux (`download_started` / `download_success`)** : Lors d'un téléchargement (`!inline`), incrémente `download_started` au démarrage, puis pipe le flux à travers un `TransformStream` dans `ctx.waitUntil` et n'incrémente `download_success` que lorsque le flux se termine intégralement sans erreur côté serveur.

---

### 4.5 Limite de débit, Blocklist, Mesures D1 et Alertes Moteurs

1. **Mode Maintenance (`settings.maintenance`)** : Si actif (`'true'`), renvoie immédiatement `503 MAINTENANCE`.
2. **Plateforme désactivée (`settings.platform_{platform}`)** : Si la plateforme détectée est à `'false'`, renvoie `403 PLATFORM_DISABLED` (et l'interface publique masque automatiquement la plateforme dans la navigation, les puces et le pied de page via `GET /api/public-config`).
3. **Blocklist (`functions/_lib/settings.ts` -> `isRequestBlocked`)** : Compare la requête aux entrées de la table D1 `blocklist` (`ip_hash`, `domain`, `url`).
4. **Rate Limit `/api/extract` et `/api/download` (`functions/_lib/ratelimit.ts`)** :
   - `/api/extract` : contrôlé par `rate_limit_per_min` (défaut **30 req/min** par IP hachée).
   - `/api/download` : contrôlé par `download_limit_per_min` (défaut **60 fichiers/min** par IP hachée, 1 comptage par fichier/min, requêtes `Range` comprises).
   - En cas d'indisponibilité de D1, bascule automatiquement sur le limiteur **Token Bucket en mémoire** (`checkRateLimit`).
5. **Mesures agrégées (`daily_metrics`) et économie d'écritures D1 (`functions/_lib/logger.ts`)** :
   - Les extractions réussies ne sont plus enregistrées ligne par ligne dans `request_log`. Elles sont agrégées dans `daily_metrics` (1 ligne par `day` UTC, `platform` et `event` : `extract_started`, `extract_success`, `extract_error`, `download_started`, `download_success`).
   - La table `request_log` conserve le détail (`error_code`, `engine_stage`, `http_status`, `duration_ms`) **uniquement pour les erreurs**.
   - **Aucun identifiant personnel** n'est stocké dans `daily_metrics` ni dans `request_log`.
   - **Économie d'écritures D1 mesurée par extraction réussie** : avant, chaque succès exécutait **3 requêtes d'écriture SQL** (`rate_limits` + `request_log` + `engine_status`, soit 4 écritures B-tree avec l'index `idx_request_log_ts`). Après, en régime stabilisé, une extraction réussie exécute **2 requêtes d'écriture SQL** (`rate_limits` + upsert `daily_metrics`, `engine_status` n'étant mis à jour en cas de succès qu'après une erreur ou au plus 1 fois par minute) et **0 insertion dans `request_log`**.
6. **Alertes automatiques (`ALERT_WEBHOOK_URL`)** :
   - À **5 échecs consécutifs** d'un moteur (`engine_status.consecutive_failures >= 5` et `alert_sent = 0`), `logExtractionEvent` envoie **UNE seule alerte** via `ALERT_WEBHOOK_URL` (compatible Webhook Discord et Bot API Telegram) dans `ctx.waitUntil`, sans jamais bloquer la réponse utilisateur.
   - Dès le prochain succès du moteur, envoie une **alerte de retour à la normale** et remet `consecutive_failures = 0` et `alert_sent = 0`.
   - Si le secret `ALERT_WEBHOOK_URL` est absent, aucune requête externe n'est effectuée.

---

## 5. Internationalisation (i18n)

### 5.1 Les 10 langues supportées (`src/i18n/config.ts`)

- **Français (`fr`)** : Langue par défaut servie **à la racine sans préfixe** (`/`, `/telecharger-video-tiktok`, etc.). Les anciens liens `/fr/...` sont résolus comme alias vers la racine canonique.
- **9 autres langues** : Servies sous le préfixe `/{code}/...` (`en`, `ar`, `es`, `pt`, `de`, `tr`, `id`, `it`, `ru`).
- **Support RTL** : L'arabe (`ar`) active automatiquement `dir="rtl"` sur la balise `<html>` et adapte la mise en page.

### 5.2 Table complète des slugs par langue

Les slugs des 5 pages plateformes sont traduits nativement pour les 8 langues à alphabet latin (`fr`, `en`, `es`, `pt`, `de`, `tr`, `id`, `it`) et utilisent les slugs anglais sous le préfixe de langue pour `ar` et `ru` :

| Langue | Préfixe | TikTok | Instagram | X (Twitter) | Facebook | LinkedIn |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| **Français (`fr`)** | *(racine)* | `/telecharger-video-tiktok` | `/telecharger-reel-instagram` | `/telecharger-video-x-twitter` | `/telecharger-video-facebook` | `/telecharger-photo-profil-linkedin` |
| **English (`en`)** | `/en` | `/en/tiktok-video-downloader` | `/en/instagram-reels-downloader` | `/en/x-twitter-video-downloader` | `/en/facebook-video-downloader` | `/en/linkedin-profile-picture-downloader` |
| **العربية (`ar`)** | `/ar` | `/ar/tiktok-video-downloader` | `/ar/instagram-reels-downloader` | `/ar/x-twitter-video-downloader` | `/ar/facebook-video-downloader` | `/ar/linkedin-profile-picture-downloader` |
| **Español (`es`)** | `/es` | `/es/descargar-video-tiktok` | `/es/descargar-reels-instagram` | `/es/descargar-video-x-twitter` | `/es/descargar-video-facebook` | `/es/descargar-foto-perfil-linkedin` |
| **Português (`pt`)** | `/pt` | `/pt/baixar-video-tiktok` | `/pt/baixar-reels-instagram` | `/pt/baixar-video-x-twitter` | `/pt/baixar-video-facebook` | `/pt/baixar-foto-perfil-linkedin` |
| **Deutsch (`de`)** | `/de` | `/de/tiktok-video-herunterladen` | `/de/instagram-reels-herunterladen` | `/de/x-twitter-video-herunterladen` | `/de/facebook-video-herunterladen` | `/de/linkedin-profilbild-herunterladen` |
| **Türkçe (`tr`)** | `/tr` | `/tr/tiktok-video-indir` | `/tr/instagram-reels-indir` | `/tr/x-twitter-video-indir` | `/tr/facebook-video-indir` | `/tr/linkedin-profil-fotografi-indir` |
| **Indonesia (`id`)** | `/id` | `/id/download-video-tiktok` | `/id/download-reels-instagram` | `/id/download-video-x-twitter` | `/id/download-video-facebook` | `/id/download-foto-profil-linkedin` |
| **Italiano (`it`)** | `/it` | `/it/scaricare-video-tiktok` | `/it/scaricare-reel-instagram` | `/it/scaricare-video-x-twitter` | `/it/scaricare-video-facebook` | `/it/scaricare-foto-profilo-linkedin` |
| **Русский (`ru`)** | `/ru` | `/ru/tiktok-video-downloader` | `/ru/instagram-reels-downloader` | `/ru/x-twitter-video-downloader` | `/ru/facebook-video-downloader` | `/ru/linkedin-profile-picture-downloader` |

**Slugs des 5 pages légales (`LEGAL_SLUGS`)** :
- Disponibles nativement en **français** (`/a-propos`, `/confidentialite`, `/conditions`, `/contact`, `/dmca`), **anglais** (`/en/about`, `/en/privacy`, `/en/terms`, `/en/contact`, `/en/dmca`) et **arabe** (`/ar/about`, `/ar/privacy`, `/ar/terms`, `/ar/contact`, `/ar/dmca`).
- Pour les 7 autres langues (`es`, `pt`, `de`, `tr`, `id`, `it`, `ru`), `getLocalizedPagePath` pointe vers les pages légales en anglais (`/en/...`).

### 5.3 Comment ajouter une nouvelle langue

1. **Créer le dictionnaire de traduction** : Créer `src/i18n/locales/{code}.ts` en copiant la structure exacte de `src/i18n/locales/en.ts` (incluant `meta`, `nav`, `hero`, `platforms`, `editorial`, `platformEditorial`, `faq`, `platformFaqs`, `footer`, `errors`, `a11y`).
2. **Déclarer la langue dans `src/i18n/config.ts`** :
   - Ajouter le code au type `SupportedLocale` et au tableau `SUPPORTED_LOCALES`.
   - Ajouter la définition dans `LOCALES_CONFIG` (`nativeName`, `shortLabel`, `dir`, `hreflang`, `ogLocale`, `prefix: '/{code}'`).
   - Ajouter les 5 slugs de plateformes dans `PLATFORM_SLUGS[{code}]`.
3. **Exporter le dictionnaire dans `src/i18n/index.ts`** : Importer le nouveau fichier `locales/{code}.ts` et l'enregistrer dans la table `TRANSLATIONS`.
4. **Régénérer et vérifier le prérendu SEO** :
   - Lancer `npm run build` (qui exécute `scripts/prerender.mjs` et met à jour `public/sitemap.xml` et `public/llms.txt`).
   - Lancer `node scripts/verify-seo.mjs` pour valider les balises `<title>`, `<meta name="description">`, `canonical`, `hreflang` et le nombre de mots éditoriaux.

---

## 6. Référencement naturel (SEO) et Performance

### 6.1 Prérendu statique (75 routes publiques)
Lors de `npm run build`, le script `scripts/prerender.mjs` génère un fichier `index.html` complet par route dans `dist/` :
- **60 routes principales avec `hreflang`** : 1 page d'accueil + 5 pages plateformes × 10 langues = **60 pages**.
- **15 routes légales** : 5 pages légales × 3 langues (`fr`, `en`, `ar`) = **15 pages**.
- **1 page `dist/404.html`** : Page d'erreur 404 autonome avec `<meta name="robots" content="noindex, nofollow">`.

Chaque page prérendue contient directement dans son HTML statique :
- Les balises `<html lang="..." dir="...">`, `<title>` (≤ 60 caractères) et `<meta name="description">` (90 à 160 caractères).
- Le contenu visible complet dans `<div id="root">` (H1, formulaire, étapes, cartes plateformes, texte éditorial natif de 150 à 250+ mots sur chaque page plateforme, accordéons FAQ et liens internes vers les autres plateformes).

### 6.2 Balises `hreflang` réciproques et `canonical`
- Chacune des 60 pages principales inclut sa balise `<link rel="canonical" href="https://vidnex.space...">` ainsi que **11 balises `<link rel="alternate" hreflang="...">`** pointant vers les 10 langues (`fr`, `en`, `ar`, `es`, `pt`, `de`, `tr`, `id`, `it`, `ru`) et `x-default` (pointant vers la version française à la racine).
- Les 15 pages légales possèdent leur `<link rel="canonical">` propre sans groupe `hreflang` incomplet.

### 6.3 `sitemap.xml`, `robots.txt` et `llms.txt`
- `public/sitemap.xml` (et `dist/sitemap.xml`) est régénéré automatiquement à chaque build avec les 75 URLs canoniques, leurs priorités (`1.0` à `0.5`), `lastmod` et les grappes `xhtml:link rel="alternate" hreflang="..."`.
- `public/robots.txt` autorise tous les robots (`User-agent: *`, `Allow: /`), bloque `/admin` et `/api/`, et référence `Sitemap: https://vidnex.space/sitemap.xml`.
- `public/llms.txt` expose un résumé Markdown structuré de VIDNEX, de ses 5 plateformes, de ses pages légales et de ses 10 langues pour les moteurs de recherche IA.

### 6.4 Données structurées JSON-LD (`Schema.org`)
Chaque page injecte un graphe `@graph` JSON-LD adapté :
- **Accueil** : `WebSite`, `Organization`, `WebApplication` et `FAQPage` (6 questions/réponses).
- **Pages plateformes** : `WebSite`, `Organization`, `WebApplication` (spécifique à la plateforme), `BreadcrumbList` (Accueil -> Plateforme) et `FAQPage` (5 questions/réponses spécifiques à la plateforme, y compris les règles de confidentialité sur les photos de profil publiques LinkedIn).
- **Pages légales** : `WebSite`, `Organization`, `WebPage` et `BreadcrumbList`.

### 6.5 Images OpenGraph (`public/og/`)
- Générées via `scripts/generate-og.mjs` au format `1200×630` pixels en JPEG optimisé (< 300 Ko) avec un hash de contenu dans le nom de fichier (`public/og/manifest.json`) pour éviter les problèmes de cache sur les réseaux sociaux :
  - `og-default.c9961d0f.jpg`
  - `og-tiktok.93d91c7d.jpg`
  - `og-instagram.659a4a9b.jpg`
  - `og-x.428741aa.jpg`
  - `og-facebook.fb1ff707.jpg`
  - `og-linkedin.08770587.jpg`
- Vérifiées automatiquement par `scripts/check-og.mjs`.

### 6.6 Gestion des 404, `noindex` et Vitesse
- **Vrai statut HTTP 404** : `worker.ts` vérifie si le chemin demandé correspond à un fichier statique existant dans `env.ASSETS`. Si le fichier n'existe pas, il sert le contenu de `/404.html` avec un **statut HTTP `404`** réel et `<meta name="robots" content="noindex, nofollow">`.
- **Protection contre l'indexation des domaines de prévisualisation (`noindex`)** :
  - `functions/_middleware.ts` et `worker.ts` ajoutent `X-Robots-Tag: noindex, nofollow` sur tout domaine `*.pages.dev` ou `*.workers.dev`, ainsi que sur `/admin` et `/api/*`.
  - Redirection permanente `301` de `https://www.vidnex.space/*` vers `https://vidnex.space/*`.
- **Performance & Code-Splitting** :
  - Le panneau `/admin` est chargé via `React.lazy(() => import('./pages/admin/AdminApp'))` dans `src/main.tsx` et isolé dans un chunk Rollup dédié (`admin-*.js` dans `vite.config.ts`). Les visiteurs publics ne téléchargent jamais le code de l'admin.
  - Les emplacements publicitaires (`src/components/AdSlot.tsx`) ne sont jamais rendus en production tant qu'un identifiant AdSense réel (`VITE_ADSENSE_CLIENT_ID`) n'est pas configuré **et** que `ads_enabled` est actif, garantissant un **CLS de 0**.

---

## 7. Panneau d'administration (`/admin`) & Comptes à droits (RBAC)

### 7.1 Authentification, Comptes par personne et Sécurité (`functions/_lib/auth.ts`)
- **Compte propriétaire principal (`ADMIN_PASSWORD`)** :
  - Identifiant : `admin` (ou `owner` / `proprietaire`).
  - Le mot de passe soumis est comparé à `env.ADMIN_PASSWORD` en temps constant (condensats `SHA-256` + `XOR` bit-à-bit via `constantTimeEqual`).
  - Conserve **tous les droits** de manière permanente et ne peut ni se désactiver ni se supprimer lui-même.
- **Comptes par personne sans service tiers (table D1 `users`)** :
  - Hachage des mots de passe via WebCrypto **`PBKDF2-SHA256`** avec un **sel aléatoire de 128 bits (16 octets)** et **100 000 itérations** (le plus grand nombre d'itérations supporté par Cloudflare Workers), stocké sous la forme `pbkdf2_sha256$100000$<saltHex>$<hashHex>`.
  - Aucun mot de passe n'est jamais journalisé, renvoyé par l'API ou stocké en clair.
  - **Création et mot de passe temporaire** : Le propriétaire crée un compte depuis l'onglet **« Utilisateurs »** (`display_name`, `login`, `role_label`, modèle de rôle ou cases à cocher). Un mot de passe temporaire de **16 caractères** est généré (ou saisi) et **affiché une seule fois** avec un bouton **« Copier »**.
  - **Changement obligatoire à la première connexion (`must_change_password = 1`)** : Dès la première connexion (ou après une réinitialisation par le propriétaire), un écran obligatoire impose de choisir un nouveau mot de passe personnel (**12 caractères minimum**, **différent du mot de passe temporaire**) avant tout accès (`403 MUST_CHANGE_PASSWORD` sur toutes les autres routes tant qu'il n'est pas changé).
- **Contrôle d'accès serveur centralisé (`requirePermission(perm)`)** :
  - Appliqué à **chaque** route `/api/admin/*` (dans `functions/_middleware.ts` et dans chaque handler).
  - **Politique « défaut = refus »** : toute route sans droit assignable explicitement déclaré est réservée au propriétaire (`403` propre `{ ok: false, errorCode: 'FORBIDDEN', message: 'Accès refusé.' }` sans détail interne).
  - **Relecture en base à chaque requête** : Pour chaque requête d'un compte `users`, `getAuthenticatedPrincipal` relit `active`, `permissions`, `must_change_password` et `session_version` dans D1.
  - **Invalidation immédiate de session (`session_version`)** : Désactiver un compte, réinitialiser son mot de passe ou modifier ses droits incrémente `session_version` dans D1 et invalide immédiatement tout cookie de session existant pour ce compte (`401`).
- **Droits assignables et domaines réservés au propriétaire** :
  - **7 droits assignables** : `dashboard.view`, `health.view`, `activity.view`, `blog.write`, `blog.edit_all`, `blog.delete`, `blog.publish` (les droits `blog.*` sont déjà enregistrés en base ; l'entrée de menu Blog n'apparaîtra que lorsque le module blog existera).
  - **Modèles rapides** :
    - **« Rédacteur blog »** : `blog.write`
    - **« Éditeur blog »** : `blog.write`, `blog.edit_all`, `blog.delete`
    - **« Observateur »** : `dashboard.view`, `health.view`, `activity.view`
  - **Réservés au propriétaire et NON assignables** : `controls`, `users`, `settings`, `services tiers`, `secrets`, `audit_log` (ainsi que les tests actifs `POST /api/admin/health`).
- **Cookie de session signé `HMAC-SHA256`** :
  - Nom du cookie : `vidnex_admin_session`.
  - Format : `admin.{expTs}.{nonce}.{sig}` (propriétaire) ou `u2.{userId}.{sessionVersion}.{expTs}.{nonce}.{sig}` (utilisateur D1), signé avec `env.SESSION_SECRET`.
  - Durée de vie : **12 heures** (`Max-Age=43200`), drapeaux `HttpOnly; Secure; SameSite=Strict; Path=/`.
- **Protection anti-brute-force par IP ET par identifiant (`login_attempts` + `users.failed_attempts`)** : Après **5 tentatives échouées** en moins de 15 minutes sur une même IP hachée ou un même identifiant, la connexion est verrouillée pendant **15 minutes** (`HTTP 429` + `Retry-After`). Message d'erreur générique : `"Identifiant ou mot de passe incorrect."`.
- **Protection anti-CSRF (`verifyCsrfAndJson`)** : Toutes les requêtes mutatives (`POST`, `PUT`, `DELETE`) sur `/api/admin/*` exigent `Content-Type: application/json` et vérifient l'en-tête `Origin`.

### 7.2 Schéma des 9 tables Cloudflare D1 (`migrations/`)

| Table D1 | Clé primaire | Colonnes principales | Rôle |
| :--- | :--- | :--- | :--- |
| **`daily_metrics`** | `(day, platform, event)` | `day`, `platform`, `event`, `count` | Compteurs journaliers agrégés sans identifiant personnel (`extract_started`, `extract_success`, `extract_error`, `download_started`, `download_success`). |
| **`request_log`** | `id` (AUTOINCREMENT) | `ts`, `platform`, `status`, `content_kind`, `engine_fn`, `engine_stage`, `http_status`, `error_code`, `duration_ms`, `ip_hash` | Journal détaillé **uniquement pour les erreurs** (`content_kind` et `engine_fn` classés depuis le motif du lien sans stocker l'URL, `http_status` vide uniquement en cas de timeout, `ip_hash` salée tronquée à 12 caractères conservée 30 jours, anciennes lignes = `—`). |
| **`settings`** | `key` (TEXT) | `key`, `value` | Paramètres dynamiques du site (`maintenance`, `platform_*`, `rate_limit_per_min`, `download_limit_per_min`, `ads_enabled`, `test_url_*`). |
| **`rate_limits`** | `(ip_hash, window)` | `ip_hash`, `window`, `count` | Compteur de requêtes par IP hachée et par minute (`/api/extract` et `dl:` pour `/api/download`). |
| **`blocklist`** | `id` (AUTOINCREMENT) | `type` (`ip_hash` \| `domain` \| `url`), `value`, `created_ts` | Liste noire administrable en direct. |
| **`engine_status`** | `platform` (TEXT) | `platform`, `last_success_ts`, `last_test_ts`, `last_test_ok`, `last_error_code`, `consecutive_failures`, `alert_sent` | État de santé en temps réel des 6 moteurs et suivi des pannes consécutives pour les alertes `ALERT_WEBHOOK_URL`. |
| **`login_attempts`** | `ip_hash` (TEXT) | `ip_hash`, `count`, `window_start_ts`, `blocked_until_ts` | Suivi des échecs de connexion `/admin` (par IP hachée et par identifiant haché `login:...`) pour le blocage anti-brute-force de 15 min. |
| **`users`** | `id` (AUTOINCREMENT) | `login`, `display_name`, `role_label`, `password_hash`, `must_change_password`, `active`, `permissions`, `session_version`, `failed_attempts`, `locked_until`, `created_at`, `last_login_at` | Comptes utilisateurs `/admin` à droits par personne (PBKDF2-SHA256 100 000 itérations). |
| **`audit_log`** | `id` (AUTOINCREMENT) | `actor`, `action`, `target`, `created_at` | Journal d'audit des connexions réussies/échouées, créations de compte, changements de droits, réinitialisations, désactivations et suppressions. |

### 7.3 Réglages système (`settings`)

| Clé dans `settings` | Valeur par défaut | Description |
| :--- | :---: | :--- |
| `maintenance` | `'false'` | Coupe toutes les extractions publiques (`503 MAINTENANCE`) et affiche une bannière de maintenance. |
| `platform_tiktok` | `'true'` | Active ou désactive TikTok (moteur + navigation + puces). |
| `platform_instagram` | `'true'` | Active ou désactive Instagram (moteur + navigation + puces). |
| `platform_x` | `'true'` | Active ou désactive X / Twitter (moteur + navigation + puces). |
| `platform_facebook` | `'true'` | Active ou désactive Facebook (moteur + navigation + puces). |
| `platform_linkedin` | `'true'` | Active ou désactive LinkedIn (moteur + navigation + puces). |
| `rate_limit_per_min` | `'30'` | Nombre maximal de requêtes `/api/extract` par minute et par IP hachée (entre `1` et `5000`). |
| `download_limit_per_min` | `'60'` | Nombre maximal de fichiers `/api/download` par minute et par IP hachée (1 comptage par fichier/min, requêtes `Range` comprises). |
| `ads_enabled` | `'true'` | Autorise ou masque l'affichage des emplacements publicitaires AdSense. |
| `test_url_tiktok` | `''` | URL TikTok utilisée par le bouton « Tester maintenant » de l'onglet Santé. |
| `test_url_instagram` | `''` | URL de publication/Reel Instagram utilisée pour le test de santé. |
| `test_url_instagram_profile` | `''` | URL ou `@username` de profil Instagram utilisé pour le test du moteur Photo de profil. |
| `test_url_x` | `''` | URL de tweet X utilisée pour le test de santé. |
| `test_url_facebook` | `''` | URL de vidéo Facebook utilisée pour le test de santé. |
| `test_url_linkedin` | `''` | URL de profil public LinkedIn (`https://www.linkedin.com/in/...`) utilisée pour le test de santé. |

### 7.4 Pages de l'interface `/admin` (`src/pages/admin/`)
1. **`Login.tsx`** : Connexion par **identifiant + mot de passe**, message d'erreur générique, bascule mode clair/sombre et redirection vers la première section autorisée.
2. **`Dashboard.tsx` (`/api/admin/stats` — droit `dashboard.view`)** : Cartes de synthèse (aujourd'hui, 7j, 30j), **entonnoir extraction -> téléchargement**, taux de réussite par plateforme, historique quotidien sur 30 jours et répartition des codes d'erreur.
3. **`Health.tsx` (`/api/admin/health` — droit `health.view` en lecture seule, tests réservés au propriétaire)** : État en temps réel des **6 moteurs** (`tiktok`, `instagram`, `instagram_profile`, `x`, `facebook`, `linkedin`). Les comptes non-propriétaires voient l'état sans aucun bouton de modification ni de test.
4. **`Controls.tsx` (`/api/admin/settings` & `/api/admin/blocklist` — réservé au propriétaire)** : Interrupteurs pour le mode maintenance, les 5 plateformes, les publicités, les limites de débit et la `blocklist`.
5. **`Activity.tsx` (`/api/admin/activity` — droit `activity.view`)** : Journal paginé des erreurs d'extraction (Date, Plateforme, Type, Fonction, Niveau, HTTP, Code erreur, Durée, IP), filtres et copie JSON.
6. **`Users.tsx` (`/api/admin/users` — réservé au propriétaire)** : Liste des utilisateurs, création avec modèles (« Rédacteur blog », « Éditeur blog », « Observateur ») ou cases à cocher, mot de passe temporaire de 16 caractères affiché une seule fois avec bouton Copier, modification des droits, réinitialisation du mot de passe, désactivation/réactivation, suppression avec confirmation et journal d'audit (`audit_log`).
7. **`Account.tsx` (`/api/admin/account` — tous les comptes connectés)** : Écran obligatoire de changement de mot de passe à la première connexion (`must_change_password`) et onglet **« Mon compte »** permettant de changer son mot de passe (12 caractères min.) et de se déconnecter.

---

## 8. Déploiement Cloudflare Pages & Workers

Le projet supporte à la fois le déploiement **Cloudflare Workers Static Assets** (via `wrangler.jsonc` et `worker.ts`) et **Cloudflare Pages** (via le dossier `functions/` et `dist/`). Voici la procédure complète et les commandes exactes :

### 8.1 Créer la base de données Cloudflare D1
Depuis la racine du projet :
```bash
npx wrangler d1 create vidnex-db
```
Copiez le `database_id` généré par cette commande et vérifiez qu'il correspond à `d1_databases[0].database_id` dans `wrangler.jsonc` :
```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "vidnex-db",
    "database_id": "2c8549cf-e4d3-41f9-943c-cd6003be8ba7"
  }
]
```
*(Si vous utilisez un projet Cloudflare Pages connecté à GitHub, vérifiez également dans **Workers & Pages > Votre projet > Settings > Bindings** que le binding D1 nommé `DB` pointe vers `vidnex-db`).*

### 8.2 Appliquer les migrations SQL (0001 à 0006)
- **En local** (pour tester avec Wrangler en local) :
  ```bash
  npx wrangler d1 migrations apply vidnex-db --local
  ```
- **En production** (sur la base D1 distante Cloudflare) :
  ```bash
  npx wrangler d1 migrations apply vidnex-db --remote
  ```

### 8.3 Configurer les secrets dans Cloudflare
Ne stockez **jamais** les valeurs des secrets dans le dépôt Git ni dans `wrangler.jsonc`.

- **Option A — Si votre projet est déployé sur Cloudflare Pages** :
  ```bash
  npx wrangler pages secret put ADMIN_PASSWORD
  npx wrangler pages secret put SESSION_SECRET
  npx wrangler pages secret put IP_HASH_SALT
  ```
  Optionnel (alertes de panne moteur Discord/Telegram et repli Instagram) :
  ```bash
  npx wrangler pages secret put ALERT_WEBHOOK_URL
  npx wrangler pages secret put IG_SESSION_ID
  ```
- **Option B — Si votre projet est déployé via `wrangler deploy` (Workers Static Assets)** :
  ```bash
  npx wrangler secret put ADMIN_PASSWORD
  npx wrangler secret put SESSION_SECRET
  npx wrangler secret put IP_HASH_SALT
  ```
  Optionnel :
  ```bash
  npx wrangler secret put ALERT_WEBHOOK_URL
  npx wrangler secret put IG_SESSION_ID
  ```

*(Pour générer une valeur aléatoire robuste pour `SESSION_SECRET` et `IP_HASH_SALT`, vous pouvez utiliser `openssl rand -hex 32` sur votre machine avant de la coller à l'invite de commande).*

### 8.4 Compiler et déployer
```bash
npm run build
npx wrangler deploy
```
Après la mise en production, vous pouvez notifier Bing et Yandex des 75 URLs du sitemap via IndexNow :
```bash
npm run indexnow
```

---

## 9. Variables et secrets

> **Règle absolue** : Aucune valeur de secret, mot de passe, cookie ou clé ne doit figurer dans le code source ou dans ce fichier. Seuls les **noms** des variables sont listés ci-dessous.

### 9.1 Bindings Cloudflare (`wrangler.jsonc`)

| Nom du Binding | Type | Description |
| :--- | :--- | :--- |
| `DB` | `D1Database` | Base de données SQLite distribuée Cloudflare D1 (`vidnex-db`). |
| `ASSETS` | `Fetcher` | Service des fichiers statiques prérendus du dossier `./dist`. |

### 9.2 Secrets et variables côté serveur (`functions/` & `worker.ts`)

| Nom de la variable | Obligatoire | Rôle dans le code |
| :--- | :---: | :--- |
| `ADMIN_PASSWORD` | **Oui** (pour `/admin`) | Mot de passe administrateur vérifié en temps constant dans `functions/api/admin/login.ts`. |
| `SESSION_SECRET` | **Oui** (pour `/admin`) | Clé secrète aléatoire utilisée pour signer et vérifier le cookie `vidnex_admin_session` en `HMAC-SHA256` (`functions/_lib/auth.ts`). |
| `IP_HASH_SALT` | **Oui** (recommandé) | Sel cryptographique ajouté à l'adresse IP avant le hachage `SHA-256` (`functions/_lib/db.ts`) pour le rate-limiting et la blocklist. |
| `ALERT_WEBHOOK_URL` | Non (optionnel) | URL de webhook Discord ou Telegram appelée en `ctx.waitUntil` à 5 échecs consécutifs d'un moteur et lors du retour à la normale (`functions/_lib/logger.ts`). |
| `IG_SESSION_ID` | Non (optionnel) | Identifiant de session Instagram utilisé en repli (Niveau 0 / Niveau 2) dans `functions/_lib/instagram.ts`. |
| `IG_CSRF_TOKEN` | Non (optionnel) | Jeton CSRF compagnon optionnel pour les requêtes Instagram authentifiées (`functions/_lib/instagram.ts`). |
| `IG_COOKIES` | Non (optionnel) | Chaîne de cookies ou tableau JSON Cookie-Editor optionnel pour Instagram (`functions/_lib/instagram.ts`). |
| `TIKWM_API_KEY` | Non (optionnel) | Clé API TikWM optionnelle si un quota supérieur à la limite publique gratuite est souhaité (`functions/_lib/tiktok.ts`). |
| `TT_COOKIE` | Non (optionnel) | Cookie TikTok optionnel transmis lors de la récupération de la page officielle (`functions/_lib/tiktok.ts`). |
| `DB_DISABLED` | Non (tests/debug) | Si défini à `'true'` ou `'1'`, désactive l'accès D1 dans `functions/_lib/db.ts` pour tester le repli sans base de données. |

### 9.3 Variables publiques côté client Vite (`src/components/AdSlot.tsx`)

| Nom de la variable | Obligatoire | Rôle dans le code |
| :--- | :---: | :--- |
| `VITE_ADSENSE_CLIENT_ID` | Non | Identifiant éditeur Google AdSense (`ca-pub-...`). Tant qu'il est vide ou absent, aucun emplacement publicitaire n'est rendu en production. |
| `VITE_ADSENSE_SLOT_HOME_HERO` | Non | Identifiant du bloc d'annonces AdSense sous la section principale de l'accueil. |
| `VITE_ADSENSE_SLOT_HOME_MID` | Non | Identifiant du bloc d'annonces AdSense intermédiaire de l'accueil. |
| `VITE_ADSENSE_SLOT_RESULT_RECTANGLE` | Non | Identifiant du bloc d'annonces AdSense sous la carte de résultat d'extraction. |
| `VITE_ADSENSE_SLOT_DESKTOP_LEFT` | Non | Identifiant du rail publicitaire latéral gauche (affiché uniquement sur grand écran `xl` ≥ 1280 px). |
| `VITE_ADSENSE_SLOT_DESKTOP_RIGHT` | Non | Identifiant du rail publicitaire latéral droit (affiché uniquement sur grand écran `xl` ≥ 1280 px). |

---

## 10. Développement local et scripts npm

### Installation
```bash
npm install
```
Pour configurer vos variables locales, copiez `.env.example` vers `.env` (ou `.dev.vars` pour Wrangler) et renseignez vos valeurs locales.

### Scripts disponibles dans `package.json`

| Commande npm | Action exécutée | Description |
| :--- | :--- | :--- |
| `npm run dev` | `tsx server.ts` | Démarre le serveur de développement local Express + Vite sur `http://localhost:3000` avec support complet des routes `/api/*`. |
| `npm run dev:cf` | `npm run build && wrangler pages dev dist` | Compile le site et lance l'émulateur local Cloudflare Pages / Workerd sur le dossier `dist/`. |
| `npm run build` | `vite build && node scripts/prerender.mjs` | Compile le bundle Vite puis prérend statiquement les 75 routes publiques, `404.html`, `sitemap.xml` et `llms.txt` dans `dist/`. |
| `npm run preview` | `vite preview` | Sert localement le dossier `dist/` compilé. |
| `npm run lint` | `tsc --noEmit && npm run lint:backend` | Vérifie le typage TypeScript de tout le frontend (`src/`) ainsi que du backend (`functions/`, `worker.ts`). |
| `npm run lint:backend` | `tsc -p tsconfig.backend.json --noEmit` | Vérifie strictement le typage TypeScript des fonctions Cloudflare et de `worker.ts`. |
| `npm test` | `npx tsx --test src/utils/urlDetector.test.ts tests/linkedin.test.ts` | Exécute la suite de tests unitaires (détecteur d'URL, LinkedIn, rate-limit `/api/download`, `daily_metrics` et alertes `ALERT_WEBHOOK_URL`). |
| `npm run generate:og` | `node scripts/generate-og.mjs` | Régénère les images OpenGraph `1200x630` dans `public/og/` et met à jour `public/og/manifest.json`. |
| `npm run indexnow` | `node scripts/indexnow.mjs` | Envoie toutes les URLs de `public/sitemap.xml` à l'API IndexNow (`api.indexnow.org`). |

---

## 11. Scripts de vérification et tests

Avant toute mise en production, trois vérifications automatisées permettent de garantir l'intégrité fonctionnelle et SEO :

1. **Tests unitaires (`npm test`)** :
   - `src/utils/urlDetector.test.ts` : Teste la détection et le rejet des URLs pour TikTok, Instagram, X, Facebook et LinkedIn.
   - `tests/linkedin.test.ts` : Teste `detectUrl` sur LinkedIn, le parsing HTML (`og:image`, `JSON-LD`, avatars « ghost », authwall), l'allowlist anti-SSRF, la limite de débit `/api/download` (`download_limit_per_min`, 1x par fichier/minute avec `Range`), les compteurs agrégés `daily_metrics` sans identifiant personnel et les alertes `ALERT_WEBHOOK_URL` à 5 échecs consécutifs + retour à la normale.
2. **Vérification des images OpenGraph (`node scripts/check-og.mjs`)** :
   - Vérifie que `public/og/manifest.json` existe et que chacune des 6 images (`default`, `tiktok`, `instagram`, `x`, `facebook`, `linkedin`) est présente, au format JPEG `1200×630` px et pèse moins de `300 Ko`.
3. **Audit SEO du build prérendu (`node scripts/verify-seo.mjs`)** :
   - Inspecte les **75 fichiers HTML** générés dans `dist/` ainsi que `dist/404.html`.
   - Vérifie pour chaque page :
     - Présence et longueur de `<title>` (≤ 65 caractères) et `<meta name="description">` (70 à 175 caractères).
     - Unicité des `<title>` et `<meta name="description">` sur les 75 routes (0 doublon).
     - Exactement **1 seule balise `<h1>`** par page.
     - Présence de `<link rel="canonical">` et des **11 liens `hreflang`** sur les 60 pages principales (et absence de `hreflang` sur les 15 pages légales).
     - Présence et validité syntaxique du bloc `<script type="application/ld+json">` (`WebSite`, `Organization`, `WebApplication`, `FAQPage`, `BreadcrumbList`).
     - Nombre de mots minimum du contenu éditorial prérendu dans `<div id="root">` (≥ 150 mots sur chaque page plateforme) et présence des liens internes vers les autres plateformes.

---

## 12. Travail à deux (Git, branches, Pull Requests)

Pour collaborer efficacement à deux développeurs sans conflit ni régression en production :

1. **Branche principale protégée (`main`)** :
   - La branche `main` correspond toujours à la version déployée en production sur `https://vidnex.space`.
   - Ne jamais pousser directement sur `main` sans avoir exécuté les vérifications locales.
2. **Convention de branches de travail** :
   - Créer une branche dédiée par fonctionnalité ou correctif :
     - `feat/nom-fonctionnalite` (ex. `feat/amelioration-moteur-tiktok`)
     - `fix/nom-bug` (ex. `fix/correction-header-rtl`)
     - `seo/nom-optimisation` (ex. `seo/enrichissement-faq`)
3. **Modification des traductions (`src/i18n/locales/*.ts`) et du schéma D1 (`migrations/`)** :
   - Toujours maintenir les **10 fichiers de langue** synchronisés avec les mêmes clés TypeScript (`TranslationSchema`).
   - Toute modification de la structure D1 doit faire l'objet d'un **nouveau fichier de migration incrémental** dans `migrations/` (ex. `0004_...sql`) sans modifier les migrations déjà appliquées en production.
4. **Checklist obligatoire avant d'ouvrir ou fusionner une Pull Request** :
   ```bash
   npm run lint
   npm test
   npm run build
   node scripts/check-og.mjs
   node scripts/verify-seo.mjs
   ```
   Toutes ces commandes doivent se terminer avec un code de sortie `0` avant la fusion (*merge*) dans `main`.

---

## 13. Limites connues et dépannage

| Symptôme observé | Cause probable | Solution / Action corrective |
| :--- | :--- | :--- |
| **LinkedIn renvoie `502 BLOCKED_BY_PLATFORM` (HTTP `999` ou redirection `/authwall`)** | LinkedIn filtre agressivement les adresses IP de centres de données (dont Cloudflare Edge) avec le code HTTP propriétaire `999` ou un mur `/authwall` sans session. | Comportement normal et documenté du moteur sans compte : VIDNEX ne contourne jamais un mur de connexion. Réessayer plus tard ou vérifier le statut exact dans `/admin` > **Santé** (`last_http_status`, `last_stage`). |
| **Instagram renvoie `502 BLOCKED_BY_PLATFORM` sur un profil ou un Reel** | L'adresse IP Cloudflare de la requête a été temporairement limitée par Instagram (`401`, `429` ou redirection `/accounts/login`). | Pour les profils et Reels fréquemment sollicités, configurer le secret optionnel `IG_SESSION_ID` (ou `IG_COOKIES`) dans Cloudflare afin d'activer le repli authentifié de Niveau 2. |
| **Facebook renvoie `403 PRIVATE_OR_LOGIN_REQUIRED` ou `502 BLOCKED_BY_PLATFORM`** | La vidéo est réservée aux amis, publiée dans un groupe privé, soumise à une limite d'âge ou Facebook impose un checkpoint anti-robot. | Vérifier que la vidéo est bien accessible publiquement en navigation privée sans compte Facebook. |
| **X (Twitter) renvoie `403 PRIVATE_OR_LOGIN_REQUIRED` sur une vidéo existante** | Le tweet est marqué comme contenu sensible / restreint par l'âge (`NsfwViewerIsLoggedOut`), ce que l'API de syndication publique d'embed masque sans compte. | Limite inhérente à l'API publique `cdn.syndication.twimg.com` (sans clé ni compte X). |
| **Erreur `500` lors de la connexion à `/admin` : « Secrets ADMIN_PASSWORD ou SESSION_SECRET non configurés »** | Les secrets Cloudflare n'ont pas encore été définis dans l'environnement d'exécution. | Exécuter `npx wrangler pages secret put ADMIN_PASSWORD` et `npx wrangler pages secret put SESSION_SECRET` (ou `npx wrangler secret put ...`), puis redéployer. |
| **Le téléchargement TikTok échoue avec `403` après quelques heures** | Les URLs signées des CDN TikTok ont une durée de vie limitée. | S'assurer que le paramètre `src` est bien transmis à `/api/download` (géré automatiquement par `ResultCard.tsx` et `extractorService.ts`) pour déclencher l'**Auto-Heal** à la volée. |
| **Le tableau de bord `/admin` affiche « Base D1 non connectée »** | Le binding D1 `DB` n'est pas relié au projet Cloudflare Pages/Workers ou les migrations n'ont pas été appliquées. | Vérifier le binding `DB` -> `vidnex-db` dans `wrangler.jsonc` / Dashboard Cloudflare et exécuter `npx wrangler d1 migrations apply vidnex-db --remote`. |

---

## 14. Pistes à venir

1. **Cache de court terme des extractions publiques** : Mettre en cache pendant 2 à 5 minutes (via Cloudflare Cache API ou une table D1 dédiée) les métadonnées d'extraction d'une même URL publique très partagée afin de réduire la pression sur les moteurs et d'accélérer les réponses répétées.
2. **Traduction native des pages légales dans les 7 langues secondaires** : Étendre `LEGAL_SLUGS` et `LegalPagesContent.tsx` pour proposer des pages légales traduites nativement en `es`, `pt`, `de`, `tr`, `id`, `it` et `ru` (actuellement redirigées vers `/en/...`).
3. **Téléchargement groupé (ZIP) pour les carrousels** : Permettre de télécharger en un seul clic l'ensemble des diapositives d'un carrousel TikTok, Instagram ou X sous forme d'archive côté client.

---

## 15. Blog

### 15.1 Architecture du Blog
- **Langue par défaut (Anglais)** : Le blog éditorial est servi par défaut en anglais sur `/blog` et `/blog/{slug}`. Les requêtes vers `/en/blog` et `/en/blog/{slug}` (ainsi que les anciens slugs ou slugs comportant un suffixe d'année `-2026`) renvoient une redirection permanente **HTTP 301** vers `/blog` et `/blog/{slug}` (`resolveBlogRedirectPath` dans `src/i18n/config.ts`, `functions/_middleware.ts` et `public/_redirects`).
- **Éditions localisées** : Le hub français est servi sur `/fr/blog` et `/fr/blog/{localizedSlug}`. Seules les langues listées dans `BLOG_HUB_LOCALES` (`src/data/blogArticles.ts`) et disposant d'au moins un article publié sont exposées.
- **Exclusion stricte des brouillons (`draft`)** : Tout article ayant `status: 'draft'` ou toute traduction ayant `translationStatus: 'draft'` renvoie une vraie **404** (`isNotFound: true`) et est exclu du prérendu statique (`scripts/prerender.mjs`), de `sitemap.xml`, de `llms.txt` et des grappes `hreflang`.
- **SEO & `hreflang` sur mesure** : Chaque article publié génère un `<link rel="canonical">` auto-référent, un graphe JSON-LD (`BlogPosting`, `BreadcrumbList`, `FAQPage`) et des balises `hreflang` réciproques **uniquement** vers ses traductions réellement publiées (plus `x-default` vers `/blog/{enSlug}`), sans jamais inventer de lien `hreflang` pour une traduction absente ou en brouillon.

### 15.2 Comment ajouter ou publier un article
1. Ouvrir `src/data/blogArticles.ts` et ajouter une entrée dans `BLOG_ARTICLES` (ou passer `status` / `translationStatus` de `'draft'` à `'published'`).
2. Renseigner un `id` et un `localizedSlug` sans année, un `metaTitle` ($\le 60$ caractères), une `metaDescription` ($90$ à $150$ caractères), le sommaire (`tableOfContents`), les sections (`content`), la FAQ (`faq`), les liens internes (`internalLinks`) et des sources officielles répondant en HTTP `200` (`sources`).
3. Exécuter `npm run build` (qui prérend les pages HTML, met à jour `sitemap.xml` et `llms.txt`, puis lance automatiquement `verify-seo.mjs` et `check-og.mjs`).

### 15.3 Comment activer une nouvelle langue sur le Blog
1. Dans `src/data/blogArticles.ts`, passer `translationStatus: 'published'` sur les traductions prêtes de cette langue (ex. `es` ou `de`) et ajouter le code langue dans `BLOG_HUB_LOCALES` ainsi que dans `isBlogHubLocale()`.
2. Vérifier les métadonnées du hub dans `BLOG_HUB_SEO[{locale}]` et les libellés d'interface dans `BLOG_UI_BY_LOCALE[{locale}]`.
3. Lancer `npm run build` et `npm test` pour valider le prérendu, la réciprocité `hreflang` et le `sitemap.xml`.

### 15.4 Gestion des articles en base D1 — Phase 1 (Données & API `/api/admin/blog`)
- **Migration D1 non destructive (`migrations/0007_blog_cms.sql`)** :
  - `blog_articles` : métadonnées maîtres (`id`, `category`, `tool_route`, `secondary_tool_route`, `status` `draft|in_review|published|trashed`, `previous_status`, `trashed_at`, `created_by`, `updated_by`, `published_at`, `created_at`, `updated_at`).
  - `blog_translations` : traductions par `(article_id, locale)` avec `slug` unique par langue, tous les champs de `BlogArticleTranslation`, `body_markdown` et `status`.
  - `blog_revisions` : historique conservant automatiquement les **10 dernières versions** par traduction `(article_id, locale)`.
  - `blog_redirects` : redirections permanentes **HTTP 301** (`old_slug -> new_slug`) enregistrées automatiquement lorsqu'un slug d'article publié est modifié.
- **Markdown restreint & Validation partagée (`src/utils/blogValidation.ts` & `scripts/verify-seo.mjs`)** :
  - Syntaxe autorisée : `H2` (`##`), `H3` (`###`), paragraphes, listes à puces, tableaux Markdown, liens (`https://` obligatoire en externe avec `rel="noopener noreferrer"` et `target="_blank"` ajoutés automatiquement) et blocs « conseil » (`:::conseil ... :::`). **Aucun HTML brut n'est accepté**.
  - Conversion directe vers la structure `sections` (`BlogContentSection[]`) et `tableOfContents` existante, sans modifier `BlogArticleView.tsx`.
  - Erreurs bloquantes communes à l'API et au build : `slug` en lettres latines minuscules, chiffres et tirets, unique par langue, **sans année** ; `metaTitle <= 60` ; `metaDescription` entre `90` et `150` caractères ; pas de `H1` dans le corps. Avertissements non bloquants : longueur `< 250` mots, FAQ absente, sources externes absentes.
- **API protégée `/api/admin/blog` (`functions/api/admin/blog.ts`)** :
  - Lecture et liste (`GET`) : `blog.write` ou plus (`blog.write`, `blog.edit_all`, `blog.delete`, `blog.publish`, ou propriétaire).
  - Création et modification de ses propres articles (`create`, `update`) : `blog.write`.
  - Modification des articles d'autrui : `blog.edit_all`.
  - Soumission en relecture (`submit_review` -> `in_review`) : `blog.write` (propres articles) ou `blog.edit_all`.
  - Mise à la corbeille et restauration 30 jours (`trash`, `restore`, `DELETE`) : `blog.delete`.
  - Publication et dépublication (`publish`, `unpublish`) : `blog.publish` ou propriétaire (**un compte sans `blog.publish` ne peut jamais passer un article en `published`**).
  - Action réservée au propriétaire (`import_existing`) : importe `src/data/blogArticles.ts` vers D1 sans doublon.
  - Toutes les actions sont journalisées dans `audit_log`.

---

## 16. Services tiers

### 16.1 Rôle des services tiers de résolution
- **TikTok (`tikwm.com`)** : Utilisé au Niveau 1 de `functions/_lib/tiktok.ts` (ainsi que pour les avatars de profils publics) afin de récupérer rapidement le flux MP4 HD sans filigrane et la piste audio originale avant de basculer, en cas d'échec ou de désactivation, sur l'analyse directe du HTML officiel TikTok (`__UNIVERSAL_DATA_FOR_REHYDRATION__` / `SIGI_STATE`, Niveau 2).
- **Instagram (`vxinstagram.com`, `ddinstagram.com`)** : Utilisés uniquement en dernier recours au Niveau 3 de `functions/_lib/instagram.ts` lorsque les niveaux directs (Niveau 0 : page d'embed publique `/embed/captioned/`, Niveau 1 : GraphQL public anonyme `/graphql/query`, Niveau 2 : API mobile privée authentifiée) sont bloqués ou limités par Instagram.
- **Suivi (`stage`)** : Dans les compteurs agrégés D1 (`daily_metrics` : `extract_success_direct` vs `extract_success_tiers`) et sur le tableau de bord `/admin`, chaque extraction réussie sur TikTok et Instagram est comptabilisée en **`direct`** ou **`tiers`** avec calcul automatique du pourcentage de succès venant d'un service tiers sur 7 jours (`thirdPartyRate7d`). Aucune URL ni identifiant personnel n'est enregistré dans les journaux.

### 16.2 Risques et limites associés
- **Dépendance externe** : Disponibilité, latence ou quotas propres à ces services tiers indépendants (`tikwm.com`, `vxinstagram.com`, `ddinstagram.com`).
- **Confidentialité du lien public** : Lorsqu'un niveau tiers est sollicité, l'URL publique du média à résoudre est transmise par le Worker Cloudflare au service tiers (toujours sans compte utilisateur, sans cookie visiteur et sans adresse IP cliente).
- **Sécurité du proxy `/api/download`** : Tant que les services tiers sont autorisés, leurs domaines figurent dans l'allowlist de `functions/_lib/allowlist.ts`. Dès qu'ils sont désactivés, `/api/download` rejette immédiatement tout téléchargement ou redirection pointant vers `tikwm.com`, `vxinstagram.com` ou `ddinstagram.com` (`HTTP 403`).

### 16.3 Comment désactiver les services tiers (sans redéploiement)
Le réglage système `allow_third_party` (activé par défaut : `'true'`) est stocké dans la table `settings` de Cloudflare D1 et lu dynamiquement à chaque requête :
1. **Depuis l'interface d'administration** : Ouvrir `/admin` -> onglet **Contrôles**, puis basculer l'interrupteur **« Services tiers (`allow_third_party`) »** sur **Désactivé**.
2. **Ou via l'API / D1 en ligne de commande** :
   ```bash
   npx wrangler d1 execute vidnex-db --remote --command "INSERT INTO settings (key, value) VALUES ('allow_third_party', 'false') ON CONFLICT(key) DO UPDATE SET value = 'false';"
   ```
Une fois désactivé (`allow_third_party = false`), **aucun appel** n'est émis vers `tikwm.com`, `vxinstagram.com` ni `ddinstagram.com` (seuls les niveaux d'extraction directs sont exécutés) et ces hôtes sont refusés par l'allowlist de `/api/download`, **immédiatement et sans redéploiement**.
