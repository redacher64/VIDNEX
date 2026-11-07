# AUDIT TECHNIQUE CLOUDFLARE (DÉPLOIEMENT & EDGE)
**Service de déploiement :** Cloudflare Pages / Cloudflare Workers Static Assets  
**Fichiers de configuration inspectés :** `wrangler.jsonc`, `worker.ts`, `functions/api/*`, `DEPLOY_FREE.md`  
**Authentification Wrangler CLI :** Non connecté (`wrangler whoami` : *You are not authenticated*)  

---

## 1. Identification du Service & Architecture de Déploiement

Le projet présente une **ambiguïté architecturale** entre deux modes de déploiement Cloudflare :

### Mode A : Cloudflare Pages (Documenté dans `DEPLOY_FREE.md` et `README.md`)
- **Principe :** Déploiement basé sur Git via le dashboard Cloudflare Pages.
- **Routage API :** Cloudflare Pages détecte automatiquement le dossier `/functions` à la racine et route `/functions/api/extract.ts` vers `GET /api/extract` et `/functions/api/download.ts` vers `GET /api/download`.
- **Paramètres de build documentés :**
  - Framework preset : `Vite`
  - Build command : `npm run build`
  - Build output directory : `dist`
  - Production branch : `main`

### Mode B : Cloudflare Workers avec Static Assets (Configuré dans `wrangler.jsonc`)
- **Principe :** Déploiement Workers de nouvelle génération introduit fin 2024 par Cloudflare.
- **Fichier de configuration `wrangler.jsonc` :**
  ```jsonc
  {
    "$schema": "node_modules/wrangler/config-schema.json",
    "name": "vidnex",
    "main": "worker.ts",
    "compatibility_date": "2024-11-01",
    "compatibility_flags": [
      "nodejs_compat"
    ],
    "build": {
      "command": "npm run build"
    },
    "observability": {
      "enabled": true
    },
    "assets": {
      "directory": "./dist",
      "binding": "ASSETS",
      "not_found_handling": "single-page-application"
    }
  }
  ```
- **Rôle de `worker.ts` :** Il sert d'adaptateur manuel qui intercepte `/api/extract`, `/api/download` et `/api/health`, et redirige toute autre requête vers `env.ASSETS.fetch(request)`.

### ⚠️ Risque de Conflit Architectural :
Si le projet est déployé en tant que Cloudflare Pages, Cloudflare exécute directement `/functions/api/*`. Si le projet est déployé via `npx wrangler deploy`, il utilise `worker.ts` et ignore le routage automatique de `/functions`. Bien que `worker.ts` réimporte les fonctions de `/functions`, cette dualité entraîne des confusions pour la maintenance et la gestion des variables d'environnement.

---

## 2. Variables d'Environnement et Secrets

| Variable / Secret | Statut | Usage dans le code | Recommandation Sécurité |
| :--- | :--- | :--- | :--- |
| `IG_SESSION_ID` | ⚠️ Optionnel | Cookie `sessionid` Instagram pour débloquer les Reels/publications restreints dans `functions/_lib/instagram.ts`. | Doit rester un secret chiffré (`wrangler secret put IG_SESSION_ID`). Ne jamais commiter dans Git. |
| `IG_CSRF_TOKEN` | ⚠️ Optionnel | Cookie CSRF optionnel présent dans les commits de `origin/main`. | Secret facultatif. |
| `TIKWM_API_KEY` | ❌ **NON CONFORME** | Clé API TikWM codée en dur par défaut dans `functions/_lib/tiktok.ts` (`origin/main`) : `DEFAULT_TIKWM_KEY = 'fbef7469f068...'`. | **Violation de sécurité.** La clé doit être supprimée du code source et migrée en variable d'environnement secrète Cloudflare. |
| `TT_COOKIE` | ⚠️ Optionnel | Cookie de session TikTok introduit dans `origin/main` pour contourner les erreurs 403 sur `v16-webapp-prime.tiktok.com`. | Doit être géré comme un secret chiffré. |
| `ASSETS` | ✅ Configuré | Binding système Cloudflare Workers pour servir le contenu statique de `./dist`. | Valide dans `wrangler.jsonc`. |

---

## 3. Paramètres de Réseau, DNS, SSL/TLS et Cache

### 3.1. Accès Dashboard vs Inspection Locale
> **Transparence technique :** La commande `npx wrangler whoami` a retourné :
> `You are not authenticated. Please run wrangler login.`
> Par conséquent, les données en temps réel dépendantes du dashboard Cloudflare (certificats SSL actifs, enregistrements DNS de la zone `vidnex.space`, règles de cache personnalisées, analytics et logs de production en direct) **ne peuvent pas être inspectées directement sans identifiants de compte**.
> Seules les règles codées dans le projet peuvent être auditées avec certitude.

### 3.2. Domaine Personnalisé et DNS
- Le fichier `src/config/appConfig.ts` déclare : `APP_DOMAIN = 'vidnex.space'`.
- Le fichier `src/components/SeoSchemaInjector.tsx` génère les URLs canoniques et JSON-LD basées sur `https://vidnex.space`.
- **Recommandation Cloudflare DNS :**
  - Enregistrement CNAME pour la racine et les sous-domaines pointant vers l'hôte Cloudflare (`vidnex.pages.dev` ou le worker associé).
  - Proxy Cloudflare activé (nuage orange) pour bénéficier de la protection DDoS, du WAF et de la terminaison SSL/TLS automatique.

### 3.3. Règles de Cache et Streaming
- Dans `functions/api/download.ts` (lignes 163-165) :
  ```typescript
  const responseHeaders = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  ```
  - `Cache-Control: no-store` : Recommandé pour le proxy de téléchargement en streaming direct afin d'éviter que Cloudflare ne mette en cache des flux binaires personnalisés ou temporaires.
- Dans `functions/api/extract.ts` :
  - Les réponses de métadonnées n'ont **aucun en-tête de cache défini**.
  - **Recommandation :** Ajouter un cache court (ex. `Cache-Control: public, max-age=60, s-maxage=300`) pour éviter de re-scraper Instagram ou TikTok si 50 utilisateurs demandent la même vidéo virale dans la même minute.

---

## 4. Limites et Ressources (Plan Cloudflare Gratuit)

Le projet vise un hébergement à 0 €/mois. Voici l'adéquation du code avec les limites du plan gratuit Cloudflare :

| Ressource Cloudflare | Limite Plan Gratuit | Consommation VIDNEX | Statut |
| :--- | :--- | :--- | :---: |
| **Requêtes Workers / jour** | 100 000 requêtes / jour | ~2 à 3 requêtes par média extrait (1 `/api/extract` + 1 à 2 `/api/download`). Capacité théorique : ~30 000 à 45 000 téléchargements/jour. | ⚠️ Risque d'épuisement sans Rate Limiting |
| **Temps CPU Workers (par requête)** | 10 ms de temps CPU (Wall time illimité pour streaming I/O) | < 2 ms CPU (simple parsing JSON et piping de stream sans transcodage). | ✅ Conforme |
| **Taille du bundle Worker** | 3 Mo compressé | `worker.ts` + dépendances pèse < 150 Ko. | ✅ Conforme |
| **Bande passante CDN** | Illimitée pour assets statiques | Streaming direct via `upstreamRes.body`. | ✅ Conforme |
| **Sous-requêtes Fetch par appel** | 50 requêtes fetch max par invocation | Max 2 fetchs amont par extraction. | ✅ Conforme |

---

## 5. Checklist d'Audit Cloudflare

- [x] Service de déploiement identifié (Cloudflare Pages Functions + Workers Static Assets via `wrangler.jsonc`).
- [x] Paramètres de build validés (`build.command: npm run build`, `output: ./dist`).
- [x] Date de compatibilité configurée (`2024-11-01`) avec drapeau `nodejs_compat`.
- [x] Streaming média direct sans mise en mémoire tampon (respectueux des limites mémoire).
- [ ] ❌ Ambiguïté entre Cloudflare Pages et Workers (fichiers `worker.ts` vs `functions/` dupliquant le routage).
- [ ] ❌ Présence d'une clé API tierce en dur au lieu d'un secret d'environnement Cloudflare chiffré.
- [ ] ❌ Absence de politique de cache sur `/api/extract` entraînant une consommation inutile du quota de requêtes.
- [ ] ⏳ Authentification CLI Cloudflare manquante pour inspecter les métriques en direct, certificats SSL et DNS réels.
