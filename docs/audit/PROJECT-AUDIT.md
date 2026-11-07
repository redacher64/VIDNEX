# RAPPORT D'AUDIT GLOBAL — PROJET VIDNEX
**Date de l'audit :** 7 novembre 2026  
**Projet :** VIDNEX (Universal Media Downloader)  
**Version déclarée :** v0.1.1 (package.json) / v2.5.0 (appConfig.ts)  
**Dépôt Git :** `https://github.com/redacher64/VIDNEX.git`  
**Environnement cible :** Cloudflare Pages / Cloudflare Workers + Static Assets  

---

## 1. Résumé Exécutif

VIDNEX est une application web monopage (SPA) conçue pour permettre le téléchargement direct de contenus multimédias publics (vidéos, photos, carrousels, photos de profil HD et pistes audio) sans filigrane. L'interface utilisateur est soignée, moderne, entièrement traduite en 5 langues et dotée d'une ergonomie réactive avec thème clair/sombre.

Cependant, un examen technique approfondi révèle un décalage majeur entre les promesses fonctionnelles / marketing affichées dans l'interface et la réalité du code déployable :
1. **Couverture des plateformes :** L'interface affiche fièrement 6 plateformes principales (Instagram, TikTok, YouTube Shorts, X/Twitter, Facebook, Snapchat) et 12 sous-outils SEO. Or, **seuls Instagram et TikTok disposent d'un connecteur d'extraction backend**. Toutes les requêtes vers YouTube, X, Facebook et Snapchat sont purement et simplement rejetées en erreur HTTP 400 par le backend (`UNSUPPORTED_URL`).
2. **Dépendance tierce masquée et clé API codée en dur :** Alors que la documentation affirme une architecture « 100 % gratuite, sans aucune API tierce », les commits récents sur la branche distante `origin/main` intègrent une clé API TikWM codée en dur dans le code source (`DEFAULT_TIKWM_KEY`), introduisant une dépendance critique externe et une violation des règles de sécurité.
3. **Téléchargements simulés et liens corrompus :** La fonctionnalité de téléchargement groupé d'un carrousel en archive `.ZIP` appelle l'URL `synthetic://carousel/archive.zip`, laquelle est bloquée en HTTP 403 par l'allowlist anti-SSRF, entraînant le téléchargement d'un fichier corrompu d'erreur JSON au lieu d'une véritable archive. De plus, plusieurs métadonnées affichées dans l'interface (durée « 00:30 », codecs, nombre d'abonnés « 142.8K », tailles de fichiers) sont des données statiques factices injectées en dur dans le frontend.
4. **Désynchronisation Git critique :** La copie locale de travail est en retard de 3 commits par rapport à `origin/main`. Les tests unitaires de la branche distante échouent lorsqu'ils sont exécutés sur le code local car des types et domaines de l'allowlist n'ont pas encore été synchronisés.
5. **Architecture Cloudflare hybride non stabilisée :** Le projet hésite entre Cloudflare Pages classique (`functions/api/*`) et Cloudflare Workers avec Static Assets (`wrangler.jsonc` + `worker.ts`), provoquant une ambiguïté sur la configuration des builds et des variables d'environnement.

---

## 2. Fiche Technique de l'Architecture

| Composant | Technologie retenue | Version | État / Observation |
| :--- | :--- | :--- | :--- |
| **Framework UI** | React | `^18.3.1` | ✅ Moderne, rendu fonctionnel avec hooks |
| **Bundler / Dev Server** | Vite | `^6.2.0` | ✅ Rapide, build de production opérationnel |
| **Langage** | TypeScript | `^5.6.3` | ⚠️ Configuration partielle (`tsconfig.json` n'inclut que `src/`) |
| **Styles & Design** | Tailwind CSS + PostCSS | `^3.4.14` | ✅ Thème chaud personnalisé, mode sombre, responsive |
| **Edge Serverless** | Cloudflare Pages Functions / Worker | Wrangler `^4.158.0` | ⚠️ Routeur dual dans `worker.ts`, typages Cloudflare manquants |
| **Moteur TikTok** | TikWM API + Fallback HTML direct | Interne | ⚠️ Dépendance externe TikWM + clé API hardcodée sur origin/main |
| **Moteur Instagram** | Embed captioned + GraphQL + Session | Interne | ⚠️ Fonctionnel sur contenus publics, limité sur restrictions d'âge |
| **Gestion d'état** | React State natif | - | ✅ Léger, pas de surcouche Redux superflue |
| **Internationalisation** | Dictionnaire interne TypeScript | Interne | ⚠️ 5 langues supportées mais messages d'erreur API en français dur |

---

## 3. Checklist Globale d'Audit Technique

Légende des statuts :
- ✅ **PASS** : Vérifié et pleinement opérationnel.
- ❌ **FAIL** : Problème technique ou non-conformité confirmé.
- ⚠️ **PARTIAL** : Implémenté de manière incomplète, partielle ou fragile.
- ⏳ **NOT TESTED** : Non vérifiable sans accès de production (identifiants Cloudflare dashboard manquants).
- ➖ **NOT APPLICABLE** : Non pertinent dans le contexte actuel.

### Synthèse par Domaines

| Domaine | Statut global | Constat principal |
| :--- | :---: | :--- |
| **Repository Git & Qualité de code** | ⚠️ PARTIAL | Branche locale en retard de 3 commits sur origin/main ; `tsconfig` ignore le backend ; absence de script de test dans `package.json`. |
| **Déploiement Cloudflare** | ⚠️ PARTIAL | `wrangler.jsonc` valide pour Workers Static Assets, mais compte non connecté en CLI (`wrangler login` requis). Pages Functions et Worker en concurrence. |
| **Fonctionnalités Downloader** | ⚠️ PARTIAL | TikTok et Instagram opérationnels pour les médias publics. YouTube, X, Facebook, Snapchat complètement absents côté backend. Faux `.ZIP`. |
| **Design & Ergonomie (UX/UI)** | ✅ PASS | Interface soignée, retour d'état clair, lecteur vidéo intégré, contrastes conformes, responsive mobile/tablette/desktop réussi. |
| **Internationalisation (i18n)** | ⚠️ PARTIAL | EN, FR, ES, PT, AR avec support RTL complet. Mais erreurs de l'extracteur codées en français dur et modale légale uniquement en anglais. |
| **Sécurité & Protection** | ❌ FAIL | Clé API tierce codée en dur dans le code source public ; proxy `/api/download` vulnérable aux redirections SSRF ; aucun rate limiting ni quota de taille. |
| **SEO & Performance** | ⚠️ PARTIAL | Titres, descriptions, JSON-LD Schema et balises hreflang injectés dynamiquement. Mais absence de balise canonique, pas de `robots.txt` ni `sitemap.xml`. |
| **Tests & Intégration Continue** | ❌ FAIL | Aucun test unitaire automatisé dans le pipeline CI ; script de test `urlDetector.test.ts` cassé en local (`describe is not defined`). |

---

## 4. Bilan Chiffré des Problèmes Identifiés

| Niveau de sévérité | Nombre | Description synthétique |
| :--- | :---: | :--- |
| **CRITIQUE (P0)** | **3** | • Clé API tierce codée en dur sur `origin/main`<br>• Faux téléchargement `.ZIP` (requête `synthetic://` renvoyant 403 Forbidden)<br>• 4 plateformes promues dans l'UI (YouTube, X, Facebook, Snapchat) rejetées par le backend |
| **ÉLEVÉ (P1)** | **3** | • Redirections non filtrées dans `/api/download` (risque de contournement SSRF)<br>• Absence totale de Rate Limiting sur les endpoints API (risque d'épuisement du quota Cloudflare 100k req/j)<br>• Désynchronisation Git locale (3 commits de retard) et tests unitaires brisés |
| **MOYEN (P2)** | **3** | • Fichiers volumineux obsolètes et doublons dans `public/samples/` (7,4 Mo dans le bundle)<br>• Absence de balise `<link rel="canonical">`, de `robots.txt` et de `sitemap.xml`<br>• Textes légaux (CGU/Politique) et messages d'erreur API non traduits (i18n incomplète) |
| **FAIBLE (P3)** | **3** | • Données télémétriques et techniques factices affichées à l'utilisateur (durée, followers, codecs)<br>• Types Cloudflare manquants et `worker.ts` utilisant `any`<br>• Script de contournement d'extension dans `index.html` exécuté avant le parsing |
