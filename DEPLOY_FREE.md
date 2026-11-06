# Guide de Déploiement 100% Gratuit & Illimité (Hugging Face Spaces + Cloudflare Pages)

Ce guide explique comment déployer le backend multi-moteurs **VIDNEX** (`/backend` : **TikWM + vxTwitter + yt-dlp + FFmpeg**) gratuitement sur **Hugging Face Spaces** (0 €, sans carte bancaire, 16 Go RAM, 2 vCPU) et connecter le frontend React sur **Cloudflare Pages** (`vidnex.space`).

---

## Étape 1 : Déployer le Backend Docker sur Hugging Face Spaces (5 clics — 0 €)

1. Créez un compte gratuit sur **[huggingface.co](https://huggingface.co/join)** puis cliquez sur **New Space** ([huggingface.co/new-space](https://huggingface.co/new-space)).
2. Configurez votre Space :
   - **Space name** : `vidnex`
   - **Select the Space SDK** : choisissez **Docker** (puis **Blank**).
   - **Space Hardware** : laissez **CPU basic · 2 vCPU · 16 GB · FREE**.
   - **Visibility** : **Public**.
   - Cliquez sur **Create Space**.
3. Dans l'onglet **Files** de votre Space, cliquez sur **+ Add file** → **Upload files** et glissez-déposez les 3 fichiers contenus dans le dossier `/backend` :
   - `backend/Dockerfile`
   - `backend/requirements.txt`
   - `backend/main.py`
4. Cliquez sur **Commit changes to main**. Hugging Face construit automatiquement le conteneur Docker avec Python 3.11, `ffmpeg` et `yt-dlp` sur le port `7860` (le badge passe à **Running** en ~2 minutes).
5. Récupérez l'URL publique directe de votre Space (bouton **⋮** en haut à droite → **Embed this Space** → **Direct URL**) :
   ```text
   https://votre-pseudo-vidnex.hf.space
   ```
   Testez-la dans votre navigateur : `https://votre-pseudo-vidnex.hf.space/api/health` renvoie `{"status":"ok","engines":["tikwm","vxtwitter","yt-dlp"],"ffmpeg":true}`.

---

## Étape 2 : Déployer le Frontend React sur Cloudflare Pages

1. Ouvrez **[Cloudflare Dashboard](https://dash.cloudflare.com/)** → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Sélectionnez votre dépôt GitHub **VIDNEX** :
   - **Framework preset** : `Vite`
   - **Build command** : `npm run build`
   - **Build output directory** : `dist`
3. Dans **Environment variables (Production & Preview)**, ajoutez :
   | Variable | Valeur |
   | :--- | :--- |
   | `VITE_API_BASE_URL` | `https://votre-pseudo-vidnex.hf.space` |
4. Cliquez sur **Save and Deploy**. Votre site est en ligne et interroge directement votre backend Docker illimité !

---

## Étape 3 (Optionnel) : Ajouter `COOKIES_TXT_BASE64` contre les blocages IP Instagram / YouTube

Si certains Reels Instagram ou vidéos YouTube demandent une session authentifiée depuis les IP cloud :

1. Exportez vos cookies au format Netscape `cookies.txt` (via l'extension navigateur *Get cookies.txt LOCALLY*).
2. Encodez le fichier en Base64 dans un terminal :
   ```bash
   base64 -w 0 cookies.txt
   ```
3. Dans votre Space Hugging Face → **Settings** → **Variables and secrets** → **New secret** :
   - **Name** : `COOKIES_TXT_BASE64`
   - **Value** : *(collez la chaîne Base64)*
4. Le backend décode automatiquement `COOKIES_TXT_BASE64` vers `/tmp/cookies.txt` et le transmet à `yt-dlp`.
