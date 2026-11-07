# VIDNEX — Universal Media Downloader (Instagram & TikTok)

Application web moderne (**React 18 + TypeScript + Vite 6 + Tailwind CSS**) propulsée par **Cloudflare Workers / Pages Functions** (`worker.ts` + `functions/`).

---

## 🌟 Caractéristiques Principales

- **100 % Gratuit & Sans Compte Obligatoire** :
  - **Instagram (3 niveaux sans compte)** : API GraphQL publique (`doc_id` officiels) + scraping `/embed/captioned/` (`contextJSON`) + passerelles publiques de secours (`vxinstagram` / `ddinstagram`).
  - **TikTok (2 niveaux sans clé en dur)** : API publique TikWM + extraction directe du JSON de réhydratation (`__UNIVERSAL_DATA_FOR_REHYDRATION__`) avec transfert automatique des cookies CDN (`tt_chain_token`, `ttwid`).
- **Téléchargement Carrousel `.ZIP` Réel** :
  - Assemblage d'une véritable archive binaire `.ZIP` standard (PKZIP STORE + CRC32) côté client avec barre de progression en direct et téléchargement individuel par diapositive.
- **Sécurité Edge & Protection Anti-SSRF** :
  - Liste blanche stricte des sous-domaines CDN médias officiels et blocage complet des plages privées RFC 1918.
  - Suivi manuel des redirections (`redirect: 'manual'`, max 4 sauts vérifiés) et limite de taille à 250 Mo (`HTTP 413`).
  - Rate Limiting Token Bucket par IP (`30 req/min` sur `/api/extract`, `60 req/min` sur `/api/download`).
- **Internationalisation (5 langues) & SEO** :
  - Interface, erreurs API et mentions légales traduites en **Français, Anglais, Espagnol, Portugais et Arabe (RTL)**.
  - Injection dynamique de `<link rel="canonical">`, `hreflang`, OpenGraph, Schema.org JSON-LD, `robots.txt` et `sitemap.xml`.

---

## 🛠️ Commandes de Développement & Vérification

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer le serveur de développement Vite (port 3000)
npm run dev

# 3. Lancer les tests unitaires et d'intégration Edge (node:test)
npm test

# 4. Vérifier le typage TypeScript (Frontend + Backend Cloudflare)
npm run lint

# 5. Compiler pour la production (dist/)
npm run build

# 6. Tester localement avec Wrangler (Worker + Static Assets)
npm run dev:cf
```

---

## 🚀 Déploiement sur Cloudflare

Le projet est préconfiguré dans `wrangler.jsonc` :
- **Build command** : `npm run build`
- **Deploy command** : `npx wrangler deploy`
- **Variables secrètes optionnelles** (aucune n'est requise pour fonctionner) :
  - `IG_SESSION_ID` : cookie `sessionid` d'un compte Instagram secondaire (optionnel, pour les Stories ou contenus restreints).
  - `TIKWM_API_KEY` : clé TikWM dédiée (optionnel, pour dépasser la limite publique de 1 req/sec).
