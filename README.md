# VIDNEX — Universal Media Downloader & Serverless RapidAPI Bridge

Application React + TypeScript propulsée par une passerelle Serverless sécurisée (`/api`) compatible avec **Vercel** et **Cloudflare Pages**.

---

## Architecture Serverless (`/api`)

Toutes les requêtes vers RapidAPI transitent exclusivement côté serveur afin que la clé secrète (`RAPIDAPI_KEY`) ne soit **jamais** exposée dans le bundle JavaScript client (`src/`) :

- **`/api/_config.ts`** : Lecture sécurisée des variables d'environnement serveur (`RAPIDAPI_KEY`, `RAPIDAPI_HOST`, `RAPIDAPI_UA`, `RAPIDAPI_TIKTOK_HOST`) et construction des en-têtes `x-rapidapi-key`, `x-rapidapi-host`, `x-rapidapi-ua`.
- **`/api/extract.ts` (`POST /api/extract`)** :
  - Reçoit l'URL et la plateforme détectée depuis l'interface VIDNEX.
  - Interroge l'API RapidAPI correspondante (`instagram-scraper-stable-api.p.rapidapi.com` en `multipart/form-data` pour Instagram Reels, Carrousels et Photos de Profil HD ; ou l'API TikTok No-Watermark).
  - Normalise la réponse JSON brute via `/api/_normalizer.ts` au format exact `MediaResult` attendu par le frontend (`VideoMediaResult`, `ProfileDpMediaResult`, `CarouselMediaResult`).
- **`/api/download.ts` (`GET /api/download`)** :
  - Proxy de flux média qui récupère le fichier brut (`.mp4`, `.jpg`, `.mp3`, `.zip`) et force l'en-tête HTTP `Content-Disposition: attachment; filename="..."` pour déclencher un téléchargement direct sur PC, iOS et Android sans ouverture d'onglet ni erreur CORS.

---

## Configuration des Variables d'Environnement

Ne préfixez **jamais** `RAPIDAPI_KEY` par `VITE_`. Configurez les variables suivantes :

| Nom de la variable | Valeur recommandée | Description |
| :--- | :--- | :--- |
| `RAPIDAPI_KEY` | `votre_cle_secrete_rapidapi` | Clé secrète injectée dans l'en-tête `x-rapidapi-key` côté serveur |
| `RAPIDAPI_HOST` | `instagram-scraper-stable-api.p.rapidapi.com` | Hôte RapidAPI principal pour Instagram (`x-rapidapi-host`) |
| `RAPIDAPI_UA` | `RapidAPI-Playground` | En-tête `x-rapidapi-ua` transmis à RapidAPI |
| `RAPIDAPI_TIKTOK_HOST` | `tiktok-video-no-watermark2.p.rapidapi.com` | Hôte RapidAPI pour l'extraction TikTok sans filigrane |

---

## Déploiement sur Vercel (Recommandé)

1. Importez votre dépôt Git sur **[Vercel](https://vercel.com/new)**.
2. Dans la section **Environment Variables** du projet (`Settings` → `Environment Variables`), ajoutez :
   - `RAPIDAPI_KEY` = `4ccf5ce995msha5582c5f65fa102p1181adjsn3547153d857f` *(ou votre clé active)*
   - `RAPIDAPI_HOST` = `instagram-scraper-stable-api.p.rapidapi.com`
   - `RAPIDAPI_UA` = `RapidAPI-Playground`
   - `RAPIDAPI_TIKTOK_HOST` = `tiktok-video-no-watermark2.p.rapidapi.com`
3. Cochez les environnements **Production**, **Preview** et **Development**, puis cliquez sur **Save**.
4. Cliquez sur **Deploy**. Vercel détecte automatiquement le dossier `/api` (`api/extract.ts` et `api/download.ts`) ainsi que `vercel.json`.

---

## Déploiement sur Cloudflare Pages

1. Connectez votre dépôt Git dans **Cloudflare Dashboard** → **Workers & Pages** → **Create application** → **Pages**.
2. Paramètres de build :
   - **Build command** : `npm run build`
   - **Build output directory** : `dist`
3. Allez dans **Settings** → **Environment variables** et ajoutez vos variables secrètes (**Encrypt** activé) :
   - `RAPIDAPI_KEY`
   - `RAPIDAPI_HOST` = `instagram-scraper-stable-api.p.rapidapi.com`
   - `RAPIDAPI_UA` = `RapidAPI-Playground`
   - `RAPIDAPI_TIKTOK_HOST` = `tiktok-video-no-watermark2.p.rapidapi.com`
4. Les fonctions exportent nativement `onRequestPost` (`api/extract.ts`) et `onRequestGet` (`api/download.ts`) pour une compatibilité directe avec le runtime Edge de Cloudflare.
