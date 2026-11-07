# AUDIT DE SÉCURITÉ & VULNÉRABILITÉS
**Priorité :** HAUTE  
**Date :** 7 novembre 2026  
**Périmètre :** Routes Edge (`/api/extract`, `/api/download`), Allowlist SSRF, Dépendances, Secrets  

---

## 1. Analyse des Vulnérabilités SSRF (Server-Side Request Forgery)

Le service reçoit des URLs fournies par des utilisateurs externes et effectue des requêtes réseau sortantes depuis les serveurs Edge de Cloudflare. C'est le vecteur d'attaque le plus sensible pour un outil de type Media Downloader.

### 1.1. Examen de l'Allowlist (`functions/_lib/allowlist.ts`)

Dans le code inspecté :
```typescript
export function isAllowedMediaHost(hostname: string): boolean {
  if (!hostname) return false;
  const lower = hostname.trim().toLowerCase();

  // Bloquer les adresses privées / locales
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.startsWith('10.') ||
    lower.startsWith('192.168.') ||
    lower.startsWith('169.254.') ||
    lower.startsWith('172.16.')
  ) {
    return false;
  }

  return ALLOWED_CDN_DOMAINS.some(
    (domain) => lower === domain || lower.endsWith(`.${domain}`)
  );
}
```

### Faiblesses et Risques Identifiés :

1. **Plage IP privée RFC 1918 incomplète :**
   - Le code bloque `lower.startsWith('172.16.')`.
   - La plage privée complète définie par la RFC 1918 est `172.16.0.0/12` (soit de `172.16.0.0` à `172.31.255.255`).
   - Les adresses `172.17.x.x` à `172.31.x.x` ne sont pas bloquées par ce test textuel basique.
   *(Bien que la condition `ALLOWED_CDN_DOMAINS` finale filtre la majorité des requêtes, ce filtre IP reste syntaxiquement incomplet).*

2. **Vulnérabilité SSRF par redirection automatique (`redirect: 'follow'`) :**
   - Dans `functions/api/download.ts` (lignes 131-135) :
     ```typescript
     const upstreamRes = await fetch(parsedTarget.toString(), {
       method: context.request.method === 'HEAD' ? 'HEAD' : 'GET',
       headers: upstreamHeaders,
       redirect: 'follow', // <-- DANGER SSRF
     });
     ```
   - **Mécanisme de risque :** Le contrôle `isAllowedMediaHost` s'exécute uniquement sur l'URL initiale fournie dans la requête. Si un CDN autorisé (ou un serveur tiers compromis) renvoie une redirection HTTP 301/302 vers une URL interne (ex. `http://169.254.169.254/latest/meta-data/` pour voler les métadonnées de l'instance ou du cluster), Cloudflare `fetch` suit automatiquement la redirection sans revalider l'hôte de destination !
   - **Correctif obligatoire :** Configurer `redirect: 'manual'` et vérifier que tout en-tête `Location` de redirection respecte rigoureusement l'allowlist avant de relancer un `fetch`.

3. **Inclusion de domaines web principaux non CDN :**
   - `ALLOWED_CDN_DOMAINS` autorise `facebook.com`, `instagram.com`, `tiktok.com`.
   - Ces domaines hébergent des applications web complexes, pas seulement des fichiers binaires média statiques. Un utilisateur malveillant pourrait abuser de `/api/download` comme d'un proxy ouvert pour sonder ces services avec l'adresse IP et les en-têtes du serveur Cloudflare.

---

## 2. Fuite de Secrets dans le Code Source Public

- **Constat :** Dans la branche distante `origin/main` (commit `89608df`), le fichier `functions/_lib/tiktok.ts` contient en clair :
  ```typescript
  const DEFAULT_TIKWM_KEY = 'fbef7469f068...[REDACTED]';
  ```
  De même, le fichier `.env.example` sur cette même branche affiche cette clé en commentaire non masqué.
- **Niveau de gravité :** **CRITIQUE**.
- **Impact :** Tout utilisateur accédant au dépôt GitHub public peut extraire et utiliser cette clé, entraînant son bannissement immédiat ou l'épuisement des quotas par des tiers.
- **Règle absolue :** Les clés API, identifiants et tokens de session ne doivent **jamais** figurer en dur dans le code source Git. Ils doivent être injectés exclusivement au runtime via des variables chiffrées Cloudflare (`wrangler secret put`).

---

## 3. Absence de Limitation de Débit (Rate Limiting) & Risque DoS

- **Endpoints exposés :**
  - `/api/extract` (Scraping amont lourd déclenchant des requêtes HTTP vers Instagram et TikWM).
  - `/api/download` (Proxy de streaming direct de fichiers binaires pouvant peser 50 Mo à 200 Mo).
- **Constat :** Aucune limitation de débit (Rate Limiting) n'est implémentée ni dans le code applicatif, ni dans la configuration `wrangler.jsonc`.
- **Impacts :**
  1. **Épuisement du quota Cloudflare :** Le plan gratuit Cloudflare Workers est limité à 100 000 requêtes par jour. Un simple script automatisé envoyant 50 requêtes/seconde peut bloquer l'ensemble du site VIDNEX en moins d'une heure.
  2. **Bannissement IP par Instagram/TikTok :** Si un attaquant inonde `/api/extract` avec des milliers d'URLs inexistantes, Instagram et TikWM bloqueront temporairement ou définitivement l'adresse IP sortante du worker Cloudflare.
- **Recommandation :** Activer la règle de limitation de débit Cloudflare WAF (ex. 30 requêtes / minute par IP) ou implémenter un token bucket léger sur KV / Upstash.

---

## 4. Absence de Limite de Taille sur les Fichiers Téléchargés

- Dans `functions/api/download.ts`, le flux binaire d'amont (`upstreamRes.body`) est directement retransmis au client sans vérification de la taille maximale (`Content-Length`).
- **Risque :** Un utilisateur pourrait solliciter le proxy pour relayer des fichiers de plusieurs gigaoctets, saturant la mémoire ou dépassant les limites d'exécution des Workers Cloudflare.
- **Recommandation :** Vérifier l'en-tête `Content-Length` en amont et rejeter les fichiers dépassant une taille raisonnable (ex. 250 Mo max) avec HTTP 413 Payload Too Large.

---

## 5. Gestion des Données Sensibles & Confidentialité

| Critère | Statut | Constat |
| :--- | :---: | :--- |
| **Fichiers `.env` ignorés par Git** | ✅ PASS | `.gitignore` exclut rigoureusement `.env`, `.env.local`, `*.local`. Aucun fichier `.env` réel n'est commité dans l'historique local. |
| **Journalisation des adresses IP** | ✅ PASS | Le code de streaming ne conserve aucun log d'activité ni adresse IP des utilisateurs en base de données ou sur disque. |
| **Assainissement des noms de fichiers** | ✅ PASS | La fonction `sanitizeFilename` nettoie strictement les noms (`VIDNEX_...`) pour empêcher toute attaque par Directory Traversal (`../`). |
| **Validation des en-têtes CORS** | ⚠️ PARTIAL | Les en-têtes renvoient `Access-Control-Allow-Origin: *`. Adéquat pour une API publique de streaming, mais à restreindre si des endpoints administratifs sont ajoutés. |

---

## 6. Checklist de Sécurité

- [x] L'allowlist restreint les requêtes aux domaines autorisés pour les cas nominaux.
- [x] La fonction `sanitizeFilename` neutralise le path traversal (`../`).
- [x] Le streaming direct s'effectue en mémoire volatile sans stockage disque permanent.
- [x] Le fichier `.gitignore` protège les fichiers `.env` locaux.
- [ ] ❌ **CRITIQUE :** Clé API tierce codée en dur dans le code source sur `origin/main`.
- [ ] ❌ **ÉLEVÉ :** Le suivi aveugle des redirections (`redirect: 'follow'`) dans `/api/download` expose à un contournement SSRF.
- [ ] ❌ **ÉLEVÉ :** Absence totale de Rate Limiting sur `/api/extract` et `/api/download`.
- [ ] ⚠️ **MOYEN :** Absence de limite de taille maximale sur les flux de téléchargement.
- [ ] ⚠️ **MOYEN :** L'allowlist inclut les domaines principaux (`instagram.com`, `facebook.com`) au lieu de se limiter aux sous-domaines CDN stricts (`*.cdninstagram.com`, `*.fbcdn.net`).
