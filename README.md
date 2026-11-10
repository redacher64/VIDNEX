# VIDNEX — Universal Media Downloader (TikTok, Instagram, X & Facebook)

Application web moderne (**React 18 + TypeScript + Vite 6 + Tailwind CSS**) propulsée par **Cloudflare Pages Functions / Workers** (`functions/` + `worker.ts`) et **Cloudflare D1** pour l'administration, avec **pré-rendu statique (SSG) en 10 langues**.

---

## 🌟 Caractéristiques Principales

- **4 Plateformes Publiques (100 % Gratuit & Sans Compte)** :
  - **TikTok** : Vidéos MP4 HD sans filigrane, diaporamas photos et pistes audio MP3.
  - **Instagram** : Reels MP4, publications photos/vidéos et carrousels multi-slides (`.ZIP`).
  - **X (Twitter)** : Vidéos MP4 multi-débits (triées par bitrate), GIFs animés convertis en MP4 et images originales (`?name=orig`).
  - **Facebook** : Vidéos publiques et Reels en qualité HD (`browser_native_hd_url`) et SD (`browser_native_sd_url`) avec résolution sécurisée des liens `fb.watch` et `/share/`.
- **SEO Technique & International (10 Langues — 65 Pages Pré-rendues)** :
  - **Langues supportées** : Français (`fr`, par défaut à la racine `/` sans préfixe), Anglais (`/en`), Arabe (`/ar`, support natif `dir="rtl"`), Espagnol (`/es`), Portugais (`/pt`), Allemand (`/de`), Turc (`/tr`), Indonésien (`/id`), Italien (`/it`) et Russe (`/ru`).
  - **Pré-rendu statique au build (`scripts/prerender.mjs`)** : chaque route publique génère son propre fichier `dist/.../index.html` contenant le `<h1>`, un guide éditorial de 300 à 500 mots, la FAQ, les liens internes `<a href>`, `<link rel="canonical">`, les balises `hreflang` réciproques (+ `x-default`) et les schémas JSON-LD (`WebSite`, `Organization`, `WebApplication`, `BreadcrumbList`, `FAQPage`).
  - **Code-splitting par langue (`src/i18n/localeLoader.ts`)** : chaque langue est isolée dans son propre fichier JSON (`src/i18n/locales/{code}.json`) afin qu'un visiteur ne télécharge jamais les 9 autres langues.
  - **Validation stricte au build (`scripts/verify-seo.mjs`)** : le build échoue automatiquement s'il manque une clé de traduction, si deux pages partagent le même `<title>` ou `<meta name="description">`, si un `hreflang` n'est pas réciproque ou si un lien interne est cassé.
- **Panneau d'Administration `/admin` (Cloudflare D1 natif, 0 API tierce)** :
  - **Dashboard analytique** : extractions aujourd'hui / 7 j / 30 j, taux de succès par plateforme, répartition des erreurs, graphique SVG/CSS des 30 derniers jours.
  - **Santé des moteurs** : statut temps réel TikTok, Instagram, X & Facebook, bouton « Tester maintenant » par plateforme.
  - **Contrôles & Sécurité** : mode maintenance global, interrupteurs par plateforme, limite de requêtes/min par IP, liste de blocage (`ip_hash`, `domain`, `url`), interrupteur Google AdSense différé.

---

## 🌐 Configuration Cloudflare : Redirection 301 (`www` → sans `www`) & Anti-Duplication

Pour éviter toute duplication de contenu dans Google :
1. **Sous-domaines techniques (`.pages.dev` / `.workers.dev`)** : `functions/_middleware.ts` et `worker.ts` injectent automatiquement l'en-tête HTTP `X-Robots-Tag: noindex, nofollow` lorsque l'hôte se termine par `.pages.dev` ou `.workers.dev`, ainsi que sur `/admin` et `/api/*`.
2. **Redirection 301 `www` vers le domaine canonique (`vidnex.space`)** :
   Dans le tableau de bord Cloudflare de votre domaine (`Rules > Redirect Rules` ou `Bulk Redirects`), créez une règle de redirection :
   - **When incoming requests match** : `Hostname equals www.vidnex.space`
   - **Then** : `Type: Dynamic`, `Expression: concat("https://vidnex.space", http.request.uri.path)`, `Status code: 301 (Permanent Redirect)`, `Preserve query string: Enabled`.

---

## 🚀 Indexation Rapide : Google Search Console, Bing Webmaster Tools & IndexNow

### 1. Google Search Console (Google n'utilise PAS IndexNow)
- Ajoutez la propriété `https://vidnex.space` dans [Google Search Console](https://search.google.com/search-console).
- Dans l'onglet **Sitemaps**, soumettez : `https://vidnex.space/sitemap.xml`.

### 2. Bing Webmaster Tools & Protocole IndexNow
- Le fichier de clé publique IndexNow est hébergé statiquement à la racine : `/vidnex2026indexnowkey9f8a7b6c5d4e3f2a1b0c.txt`.
- Après chaque déploiement en production sur `https://vidnex.space`, exécutez manuellement la commande suivante pour notifier instantanément **Bing, Yandex, Naver et Seznam** des 65 URLs publiques :

```bash
# Vérifier le payload JSON sans envoyer de requête réseau :
npm run indexnow -- --dry-run

# Notifier IndexNow (Bing / Yandex) après mise en ligne sur https://vidnex.space :
npm run indexnow
```

---

## 🔒 Sécurité du Panneau `/admin` & Cloudflare Access (Optionnel)

Le panneau `/admin` intègre nativement :
1. **Comparaison en temps constant** (`SHA-256` + XOR) du mot de passe `ADMIN_PASSWORD`.
2. **Cookie de session signé `HMAC-SHA256`** (`SESSION_SECRET`) via Web Crypto API (`HttpOnly`, `Secure`, `SameSite=Strict`, `12h`).
3. **Protection anti-brute-force D1** (`login_attempts`) : blocage automatique de 15 minutes après 5 échecs.
4. **Protection CSRF** : validation de `Content-Type: application/json` et de l'en-tête `Origin`.
5. **Désindexation complète** : `X-Robots-Tag: noindex, nofollow` et `<meta name="robots" content="noindex, nofollow">`.

> **Couche supplémentaire optionnelle (Cloudflare Access / Zero Trust)** :
> Vous pouvez protéger `/admin*` et `/api/admin/*` derrière une politique **Cloudflare Access (Zero Trust)** gratuite dans le dashboard Cloudflare (*Zero Trust > Access > Applications*).

---

## 🛠️ Commandes de Développement & Build

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer le serveur de développement Vite (port 3000)
npm run dev

# 3. Lancer la suite de tests unitaires et d'intégration (node:test)
npm test

# 4. Vérifier le typage TypeScript (Frontend + Backend Cloudflare)
npm run lint

# 5. Compiler, pré-rendre les 65 pages HTML + sitemap.xml et auditer le SEO (dist/)
npm run build
```
