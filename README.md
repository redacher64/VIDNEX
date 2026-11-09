# VIDNEX — Universal Media Downloader (Instagram & TikTok)

Application web moderne (**React 18 + TypeScript + Vite 6 + Tailwind CSS**) propulsée par **Cloudflare Workers / Pages Functions** (`worker.ts` + `functions/`) et **Cloudflare D1** pour l'administration.

---

## 🌟 Caractéristiques Principales

- **100 % Gratuit & Sans Compte Obligatoire** :
  - **Instagram (3 niveaux sans compte)** : API GraphQL publique (`doc_id` officiels) + scraping `/embed/captioned/` (`contextJSON`) + passerelles publiques de secours (`vxinstagram` / `ddinstagram`).
  - **TikTok (2 niveaux sans clé en dur)** : API publique TikWM + extraction directe du JSON de réhydratation (`__UNIVERSAL_DATA_FOR_REHYDRATION__`) avec transfert automatique des cookies CDN (`tt_chain_token`, `ttwid`).
- **Panneau d'Administration `/admin` (Cloudflare D1 natif, 0 API tierce)** :
  - **Dashboard analytique** : extractions aujourd'hui / 7 j / 30 j, taux de succès par plateforme, répartition des erreurs, graphique SVG/CSS des 30 derniers jours.
  - **Santé des moteurs** : statut temps réel TikTok & Instagram, test d'extraction en direct sur URL fournie par l'admin, vérification du cookie Instagram sans jamais exposer sa valeur.
  - **Contrôles & Sécurité** : mode maintenance global, activation/désactivation par plateforme, limite de requêtes/min par IP, liste de blocage (`ip_hash`, `domain`, `url`), interrupteur Google AdSense.
  - **Résilience totale** : si D1 est indisponible, l'extraction publique continue de fonctionner sans interruption.
- **Téléchargement Carrousel `.ZIP` Réel** :
  - Assemblage d'une véritable archive binaire `.ZIP` standard (PKZIP STORE + CRC32) côté client avec barre de progression en direct et téléchargement individuel par diapositive.
- **Sécurité Edge & Protection Anti-SSRF** :
  - Liste blanche stricte des sous-domaines CDN médias officiels et blocage complet des plages privées RFC 1918.
  - Suivi manuel des redirections (`redirect: 'manual'`, max 4 sauts vérifiés) et limite de taille à 250 Mo (`HTTP 413`).
- **Internationalisation (5 langues) & SEO** :
  - Interface, erreurs API et mentions légales traduites en **Français, Anglais, Espagnol, Portugais et Arabe (RTL)**.
  - Injection dynamique de `<link rel="canonical">`, `hreflang`, OpenGraph, Schema.org JSON-LD, `robots.txt` et `sitemap.xml`.

---

## 🔒 Sécurité du Panneau `/admin` & Cloudflare Access (Optionnel)

Le panneau `/admin` intègre nativement :
1. **Comparaison en temps constant** (`SHA-256` + XOR) du mot de passe `ADMIN_PASSWORD`.
2. **Cookie de session signé `HMAC-SHA256`** (`SESSION_SECRET`) via Web Crypto API avec les attributs `HttpOnly`, `Secure`, `SameSite=Strict` et expiration de `12h`.
3. **Protection anti-brute-force D1** (`login_attempts`) : blocage automatique de 15 minutes après 5 tentatives échouées.
4. **Protection CSRF** : exigence stricte de `Content-Type: application/json` et validation de l'en-tête `Origin` sur toutes les routes de modification (`POST`, `PUT`, `DELETE`).
5. **Désindexation complète** : en-tête HTTP `X-Robots-Tag: noindex, nofollow` via `functions/_middleware.ts` et balise `<meta name="robots" content="noindex, nofollow">`.

> **Couche supplémentaire optionnelle (Cloudflare Access / Zero Trust)** :
> Pour une défense en profondeur maximale, vous pouvez placer les chemins `/admin*` et `/api/admin/*` derrière une politique **Cloudflare Access (Zero Trust)** gratuite (jusqu'à 50 utilisateurs) dans le dashboard Cloudflare (*Zero Trust > Access > Applications*), exigeant un code OTP par e-mail ou Google/GitHub SSO avant même d'atteindre le Worker.

---

## 🛠️ Commandes de Développement & Vérification

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer le serveur de développement Vite (port 3000)
npm run dev

# 3. Lancer les tests unitaires et d'intégration Edge + Admin D1 (node:test)
npm test

# 4. Vérifier le typage TypeScript (Frontend + Backend Cloudflare)
npm run lint

# 5. Compiler pour la production (dist/)
npm run build
```

Consultez **[SETUP.md](./SETUP.md)** pour les commandes exactes de création de la base Cloudflare D1, d'application des migrations et de configuration des secrets.
