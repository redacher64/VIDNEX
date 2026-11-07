# FEUILLE DE ROUTE & PLAN DE CORRECTION PRIORITAIRE
**Date :** 7 novembre 2026  
**Objectif :** Rendre VIDNEX 100 % fonctionnel, sécurisé, fiable, professionnel et conforme à ses engagements.  

---

## 1. Top 10 des Problèmes Majeurs Classés par Priorité

| Rang | Problème Identifié | Fichier(s) Concerné(s) | Gravité | Impact Utilisateur | Solution Recommandée |
| :-: | :--- | :--- | :---: | :--- | :--- |
| **01** | **Clé API tierce codée en dur dans le code source** | `functions/_lib/tiktok.ts` (sur origin/main), `.env.example` | **CRITIQUE** | Risque de bannissement, vol de quota, fuite de secret sur GitHub public. | Supprimer la constante en dur. Migrer vers le secret Cloudflare `TIKWM_API_KEY` injecté au runtime. |
| **02** | **Faux téléchargement `.ZIP` Carrousel (Erreur 403 téléchargée)** | `src/components/ResultDrawer.tsx` | **CRITIQUE** | L'utilisateur clique sur « Télécharger .ZIP » et reçoit un fichier corrompu de 80 octets contenant une erreur JSON. | Supprimer l'URL factice `synthetic://`. Soit générer un vrai zip côté client (JSZip), soit proposer le téléchargement individuel direct transparent. |
| **03** | **4 plateformes affichées dans l'UI mais rejetées par le backend** | `functions/api/extract.ts`, `functions/_lib/detect.ts`, `Header.tsx` | **CRITIQUE** | Frustration totale : un utilisateur collant un lien YouTube Shorts, X, Facebook ou Snapchat reçoit une erreur 400. | Soit masquer temporairement ces onglets de l'en-tête, soit implémenter leurs connecteurs d'extraction autorisés. |
| **04** | **Vulnérabilité SSRF par redirection automatique** | `functions/api/download.ts` (ligne 134) | **ÉLEVÉ** | Risque de contournement de l'allowlist CDN et d'atteinte aux ressources réseau internes du cluster. | Configurer `redirect: 'manual'` dans `fetch` et valider rigoureusement l'en-tête `Location` avant tout suivi. |
| **05** | **Absence de Rate Limiting sur les endpoints API** | `worker.ts`, `functions/api/*`, `wrangler.jsonc` | **ÉLEVÉ** | Risque de DoS et d'épuisement rapide du quota gratuit Cloudflare (100k req/j) en quelques minutes d'attaque. | Activer une règle Cloudflare Rate Limiting (WAF) ou implémenter un token bucket léger par adresse IP. |
| **06** | **Désynchronisation Git locale et tests unitaires brisés** | Working tree local vs `origin/main`, `src/utils/urlDetector.test.ts` | **ÉLEVÉ** | Tests locaux inutilisables (`describe is not defined`), divergence de code entre l'environnement de dev et GitHub. | Aligner le code local sur `origin/main`, migrer définitivement les tests vers `node:test` et ajouter `"test": "node --test"` dans `package.json`. |
| **07** | **Balise canonique `<link rel="canonical">` manquante** | `src/components/SeoSchemaInjector.tsx` | **MOYEN** | Risque de pénalité SEO pour contenu dupliqué sur Google/Bing avec les paramètres `?tool=` et `?lang=`. | Injecter formellement `<link rel="canonical" href="...">` dans le `<head>` du document DOM. |
| **08** | **Fichiers essentiels SEO manquants (`robots.txt`, `sitemap.xml`)** | Dossier `public/` | **MOYEN** | Mauvaise indexation par les moteurs de recherche, requêtes 404 sur `favicon.ico` et `robots.txt`. | Créer `public/robots.txt`, générer `public/sitemap.xml` avec les 12 silos multilingues et ajouter un favicon. |
| **09** | **Traductions incomplètes (Erreurs en français dur, CGU en anglais)** | `src/services/extractorService.ts`, `src/components/LegalModal.tsx` | **MOYEN** | Expérience dégradée pour les visiteurs internationaux (arabophones, hispanophones, anglophones). | Relier les messages d'erreur API au dictionnaire `UI_TRANSLATIONS` et traduire le texte des conditions légales. |
| **10** | **Assets volumineux obsolètes polluant le bundle (`public/samples/`)** | `public/samples/*`, `public/assets/aistudio/*` | **FAIBLE** | 7,4 Mo de vidéos et archives inutiles recopiées dans `dist/` à chaque compilation. | Supprimer définitivement ces reliquats de test du dépôt local et du build de production. |

---

## 2. Plan de Correction par Petites Étapes

### 🔹 Étape 1 : Assainissement Git, Secrets & Sécurité Immédiate
- **Actions :**
  1. Synchroniser le working tree local avec `origin/main` pour intégrer les correctifs récents de redacher64.
  2. Supprimer la clé API codée en dur dans `functions/_lib/tiktok.ts` et la remplacer par `env?.TIKWM_API_KEY`.
  3. Corriger la vulnérabilité SSRF dans `functions/api/download.ts` en désactivant le suivi automatique (`redirect: 'manual'`) et en validant l'en-tête de redirection contre l'allowlist.
  4. Réparer le fichier de test unitaire pour qu'il s'exécute nativement avec `node --test` et ajouter le script `"test": "node --test"` dans `package.json`.
- **Estimation de complexité :** Faible (1 à 2 heures).
- **Dépendances :** Aucune.

### 🔹 Étape 2 : Résolution du Faux ZIP et Fiabilisation des Données
- **Actions :**
  1. Supprimer l'appel fantôme `synthetic://carousel/archive.zip` dans `ResultDrawer.tsx`.
  2. Implémenter une vraie solution carrousel : soit l'intégration d'un générateur d'archive ZIP côté client (via `jszip`), soit un bouton clair de téléchargement diapositive par diapositive.
  3. Supprimer les métadonnées factices injectées dans `extractorService.ts` (faux nombre de followers, faux codecs 60fps) au profit de badges réalistes reflétant les métadonnées effectivement renvoyées par le backend.
- **Estimation de complexité :** Moyenne (2 à 3 heures).
- **Dépendances :** Étape 1 terminée.

### 🔹 Étape 3 : Clarification des Plateformes (Frontend & Backend)
- **Actions :**
  1. Deux options au choix de l'utilisateur :
     - **Option A (Recommandée à court terme) :** Masquer les onglets YouTube, X, Facebook, Snapchat ou les marquer du badge « Bientôt disponible » pour ne pas induire les utilisateurs en erreur.
     - **Option B (Extension) :** Implémenter les connecteurs autorisés pour YouTube Shorts et Facebook Reels côté Cloudflare Functions.
- **Estimation de complexité :** Option A : Faible (1 heure) / Option B : Élevée (1 à 2 jours).
- **Dépendances :** Étape 2.

### 🔹 Étape 4 : SEO, Balisage Canonique & Internationalisation Complète
- **Actions :**
  1. Ajouter l'injection effective de `<link rel="canonical">` dans `SeoSchemaInjector.tsx`.
  2. Créer `public/robots.txt`, `public/sitemap.xml` et ajouter le favicon SVG/ICO.
  3. Internationaliser les messages d'erreur de `extractorService.ts` dans les 5 langues (`en`, `fr`, `es`, `pt`, `ar`).
  4. Traduire le contenu de la modale légale `LegalModal.tsx` pour l'arabe, l'espagnol, le portugais et le français.
- **Estimation de complexité :** Moyenne (2 à 3 heures).
- **Dépendances :** Aucune (peut être fait en parallèle).

### 🔹 Étape 5 : Stabilisation TypeScript & Configuration Cloudflare
- **Actions :**
  1. Créer un `tsconfig.backend.json` ou inclure `worker.ts` et `functions/**/*.ts` avec les définitions `@cloudflare/workers-types`.
  2. Harmoniser `DEPLOY_FREE.md` et `wrangler.jsonc` pour définir sans ambiguïté la cible de déploiement en production.
  3. Mettre en place une limitation de débit (Rate Limiting) sur les requêtes Edge.
- **Estimation de complexité :** Faible à Moyenne (2 heures).
- **Dépendances :** Étapes 1 et 3.

---

## 3. Statut d'Arrêt Conforme aux Consignes

> **ARRÊT STRICT :** Conformément aux consignes de la mission (*« ARRÊTE-TOI APRÈS LE RAPPORT. Ne commence aucune correction avant que je valide le plan »*), aucune modification de code correctrice n'a été entreprise.
> L'ensemble des 8 rapports d'audit est rédigé et disponible dans `docs/audit/`.
