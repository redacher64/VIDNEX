# 🚀 Structure & Guide Cloudflare Pages — Téléchargement Gratuit Instagram & TikTok

Ce projet est épuré et structuré exclusivement pour **Cloudflare Pages + Cloudflare Pages Functions** (aucun dossier Vercel `/server`, ni Docker/Hugging Face `/backend`).

---

## 📁 Structure Finale du Projet

```text
├── functions/                  # Backend Serverless Cloudflare Pages (100 % Gratuit)
│   ├── _lib/
│   │   ├── allowlist.ts        # Sécurité anti-SSRF (CDNs officiels TikTok, TikWM & Meta/Instagram)
│   │   ├── detect.ts           # Détection d'URLs et @usernames (TikTok & Instagram)
│   │   ├── http.ts             # Client HTTP Edge avec suivi des cookies et User-Agent navigateur
│   │   ├── instagram.ts        # Moteur Instagram Gratuit (Niveau 1 Sans Compte + Niveau 2 Compte Backend)
│   │   ├── normalize.ts        # Schéma JSON unifié (vidéo, carrousel, audio, profil DP)
│   │   └── tiktok.ts           # Moteur TikTok Gratuit (Niveau 1 API Directe + Niveau 2 Scraping HTML)
│   └── api/
│       ├── extract.ts          # Endpoint GET/POST /api/extract
│       └── download.ts         # Proxy de streaming direct GET /api/download (Zero-Buffering)
├── public/
│   └── .assetsignore           # Exclusion des règles conflictuelles Cloudflare Assets
├── src/                        # Frontend React + Tailwind CSS + Vite
├── worker.ts                   # Point d'entrée Cloudflare Worker / Dev local
└── wrangler.jsonc              # Configuration Cloudflare Pages / Workers
```

---

## ⚙️ Comment fonctionne le téléchargement gratuit (TikTok & Instagram) ?

### 1. TikTok (Vidéos HD 1080p sans filigrane, Carrousels Photos, MP3, Profil DP)
- **Faut-il connecter un compte ?** **Non, aucun compte n'est requis.**
- **Fonctionnement** :
  - **Niveau 1 (Prioritaire)** : Utilise le moteur gratuit **TikWM** (`https://www.tikwm.com/api/` avec `hd=1`) qui contourne le pare-feu WAF de TikTok sur les adresses IP Cloudflare et extrait directement le flux MP4 1080p sans filigrane, l'audio MP3 et les diaporamas photos.
  - **Niveau 2 (Secours automatique)** : Si TikWM ne répond pas, analyse directement le JSON de réhydratation (`__UNIVERSAL_DATA_FOR_REHYDRATION__` / `SIGI_STATE`) de la page officielle TikTok.

---

### 2. Instagram (Reels HD, Publications, Carrousels, Photos de Profil DP)
Instagram applique des restrictions progressives selon le type de publication. C'est pourquoi `functions/_lib/instagram.ts` intègre **2 options automatiques** :

#### Option A — Sans compte connecté (Niveau 1 : Actif par défaut)
- **Embed Captioned Officiel** (`/p/{shortcode}/embed/captioned/`) : Extrait gratuitement les vidéos, images et données embarquées publiques.
- **API GraphQL Publique Anonyme** (`https://www.instagram.com/graphql/query`) : Lorsqu'un Reel masque son flux vidéo dans l'embed, interroge directement l'API GraphQL d'Instagram avec l'identifiant d'application web (`X-IG-App-ID: 936619743392459`) **sans compte**.
- **Profils Publics (`@username`)** : Extrait la photo de profil HD 1080×1080 via `web_profile_info` et `og:image`.

#### Option B — Connecter un compte Instagram sur le Backend Cloudflare Pages (Niveau 2 : Recommandé pour débloquer 100 % des Reels)
Certains Reels Instagram (contenus soumis à une limite d'âge, Reels restreints aux utilisateurs connectés, Stories, ou lorsque l'IP Cloudflare atteint la limite anonyme d'Instagram) **exigent qu'un compte soit connecté côté backend**.

👉 **Comment connecter un compte Instagram sur votre backend Cloudflare Pages (en 2 minutes) :**
1. Créez ou utilisez un **compte Instagram secondaire** (n'utilisez jamais votre compte personnel principal).
2. Ouvrez une fenêtre de **navigation privée** sur votre ordinateur (Chrome, Edge ou Brave) et connectez-vous à `https://www.instagram.com`.
3. Appuyez sur **`F12`** (Outils de développement) > onglet **Application** (ou *Stockage*) > **Cookies** > `https://www.instagram.com`.
4. Cherchez la ligne **`sessionid`** et copiez sa **Valeur** (ex. `123456789%3Aabcdef...`). *(Ne cliquez pas sur "Se déconnecter" avant de fermer la fenêtre privée, sinon le cookie sera invalidé).*
5. Allez dans votre tableau de bord **Cloudflare Pages** :
   - Ouvrez votre projet **`vidnex`** > **Settings** > **Environment variables**.
   - Cliquez sur **Add variable** (choisissez le type **Secret / Encrypt**) :
     - **Variable name** : `IG_SESSION_ID`
     - **Value** : *(collez la valeur de votre `sessionid`)*
   - *(Optionnel)* Vous pouvez aussi ajouter `IG_CSRF_TOKEN` avec la valeur du cookie `csrftoken`.
6. Redéployez votre projet Cloudflare Pages (**Deployments** > **Retry deployment**).

Dès que `IG_SESSION_ID` est présent, votre backend l'utilise automatiquement uniquement lorsque le Niveau 1 sans compte est bloqué par Instagram !
