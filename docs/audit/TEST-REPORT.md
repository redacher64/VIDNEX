# RAPPORT D'EXÉCUTION DES TESTS TECHNIQUES
**Date d'exécution :** 7 novembre 2026  
**Environnement :** Node.js v24.21.0, Windows, Shell PowerShell  
**Règle de rigueur :** Aucun résultat n'est simulé ; tous les tests consignés ci-dessous ont été réellement exécutés.  

---

## 1. Synthèse des Tests Exécutés

| N° | Test Exécuté | Commande / Méthode | Résultat | Code Sortie | Preuve / Observation |
| :-: | :--- | :--- | :---: | :-: | :--- |
| **01** | Vérification TypeScript Frontend | `npm run lint` (`tsc --noEmit`) | ✅ PASS | 0 | Aucune erreur TypeScript dans le dossier `src/`. |
| **02** | Compilation de Production | `npm run build` (`tsc && vite build`) | ✅ PASS | 0 | Bundle généré en 5.07s dans `dist/` (JS : 290 Ko, CSS : 38 Ko). |
| **03** | Vérification TypeScript Backend | `npx tsc --noEmit worker.ts` | ❌ FAIL | 1 | Échec : `worker.ts` et `functions/` sont exclus de `tsconfig.json` ; le compilateur utilise la cible ES5 par défaut. |
| **04** | Tests Unitaires Locaux | `node --test src/utils/urlDetector.test.ts` | ❌ FAIL | 1 | Échec immédiat : `ReferenceError: describe is not defined`. Le fichier utilise la syntaxe Jest sans runner installé. |
| **05** | Tests Unitaires `origin/main` | `node --experimental-strip-types scratch/test-origin-main.mjs` | ❌ FAIL | 1 | 1/3 réussi, 2/3 échoués : la version locale n'a pas les types `kind` ni le domaine `tikwm.com` dans l'allowlist. |
| **06** | Endpoint Routeur `/api/health` | Appel direct `worker.fetch(new Request('/api/health'))` | ✅ PASS | 200 | Réponse : `{"status":"ok","engines":["tiktok_direct","instagram_direct"]}`. |
| **07** | Endpoint `/api/extract` (Paramètre vide) | `worker.fetch('/api/extract')` | ✅ PASS | 400 | Rejet conforme : `UNSUPPORTED_URL`, paramètre url manquant. |
| **08** | Endpoint `/api/extract` (URL YouTube) | `worker.fetch('/api/extract?url=https://youtube.com/shorts/...')` | ❌ FAIL* | 400 | Preuve irréfutable : YouTube est rejeté avec `UNSUPPORTED_URL` (*échec fonctionnel du connecteur). |
| **09** | Sécurité Anti-SSRF Domaine Interdit | `worker.fetch('/api/download?url=https://evil.example.com/bad.mp4')` | ✅ PASS | 403 | Blocage conforme : `Domaine média non autorisé : evil.example.com`. |
| **10** | Faux Protocole `.ZIP` | `worker.fetch('/api/download?url=synthetic://carousel/archive.zip')` | ❌ FAIL* | 403 | Preuve irréfutable : Le faux ZIP du frontend est bloqué en 403 (*échec fonctionnel de la fonctionnalité carrousel). |
| **11** | Gestion Erreurs Extraction Réseau | `worker.fetch('/api/extract?url=instagram/tiktok')` en offline | ✅ PASS | 200 | Les exceptions réseau sont interceptées sans crash serveur. (Code HTTP 200 à corriger en 502/504). |
| **12** | Authentification Wrangler CLI | `npx wrangler whoami` | ⏳ NON CONNECTÉ | 0 | Sortie : `You are not authenticated. Please run wrangler login`. Dashboard distant inaccessible sans identifiants. |

---

## 2. Détail des Résultats de Tests Critiques

### Test 03 : Compilation TypeScript du Backend
- **Commande :** `npx tsc --noEmit worker.ts`
- **Erreurs relevées :**
  ```text
  worker.ts(12,54): error TS2705: An async function or method in ES5 requires the 'Promise' constructor.
  functions/_lib/allowlist.ts(36,11): error TS2550: Property 'startsWith' does not exist on type 'string'.
  ```
- **Diagnostic :** Le fichier `tsconfig.json` contient `"include": ["src"]`. Ni `worker.ts` ni le dossier `functions/` ne sont couverts par une configuration TypeScript valide.

### Test 04 & 05 : Tests Unitaires
- **Test 04 (Fichier local `src/utils/urlDetector.test.ts`) :**
  ```text
  file:///.../urlDetector.test.ts:4
  describe?.('detectMediaUrl', () => {
  ^
  ReferenceError: describe is not defined
  ```
  Le code fait appel à `describe` sans importer de framework de test.
- **Test 05 (Version `origin/main` exécutée sur le code local) :**
  - Test 1 (Frontend regex) : ✅ Réussi.
  - Test 2 (`detectUrl` serveur) : ❌ Échec (`kind: 'post'` absent de la version locale).
  - Test 3 (Allowlist `tikwm.com`) : ❌ Échec (`tikwm.com` non autorisé dans l'allowlist locale).

### Test 08 & 10 : Preuves Techniques de Non-Fonctionnalité
- **Appel YouTube sur `/api/extract` :**
  ```json
  {
    "ok": false,
    "error": {
      "code": "UNSUPPORTED_URL",
      "message": "URL non supportée. VIDNEX prend en charge les vidéos/photos TikTok et les Reels/posts Instagram."
    }
  }
  ```
- **Appel Carrousel `.ZIP` sur `/api/download` :**
  ```json
  {
    "error": "Domaine média non autorisé : carousel. Le proxy est réservé aux CDNs officiels."
  }
  ```
  L'utilisateur télécharge ce JSON au lieu de ses photos.

---

## 3. Conclusion des Tests

Le socle technique React + Vite est stable et se compile rapidement sans erreur. Les fonctions existantes pour TikTok et Instagram s'exécutent conformément à leur logique interne. En revanche, **les tests confirment sans équivoque que les connecteurs YouTube, X, Facebook, Snapchat et l'archive ZIP sont totalement inopérants**.
