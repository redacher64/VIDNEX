# AUDIT FONCTIONNEL DU DOWNLOADER & CONNECTEURS PLATEFORMES
**Projet :** VIDNEX Downloader  
**Date de l'audit :** 7 novembre 2026  

---

## 1. Matrice d'Évaluation par Plateforme

Le cahier des charges impose une vérification rigoureuse et individuelle de chaque plateforme supportée ou affichée dans le service.

| Plateforme | 1. Interface disponible ? | 2. Connecteur implémenté ? | 3. Méthode d'accès autorisée ? | 4. Tests effectués ? | 5. Téléchargement réellement fonctionnel ? | 6. Restrictions connues | Statut |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- | :---: |
| **Instagram** | ✅ Oui (Onglet, icône, 4 sous-outils) | ✅ Oui (`functions/_lib/instagram.ts`) | ✅ Analyse embed public + GraphQL anonyme + cookie `sessionid` optionnel | ✅ Testé (mock & sandbox) | ⚠️ **Partiel** (Vidéos et images publiques OK, comptes restreints bloqués sans session) | Instagram applique un rate limiting agressif sur les IPs de datacenters Cloudflare. Les stories et comptes privés restent inaccessibles sans compte connecté. | ⚠️ **PARTIAL** |
| **TikTok** | ✅ Oui (Onglet, icône, 4 sous-outils) | ✅ Oui (`functions/_lib/tiktok.ts`) | ✅ API TikWM sans watermark + Scraping direct du JSON officiel | ✅ Testé (endpoints & validation) | ⚠️ **Partiel** (Vidéos, photos, MP3 OK via TikWM ; fragile en direct HTML) | TikTok active régulièrement un challenge WAF (`SlardarWAF`) sur les requêtes directes. Limite de 1 req/sec sur l'API TikWM gratuite. | ⚠️ **PARTIAL** |
| **YouTube** | ✅ Oui (Onglet "YouTube", slug `youtube-shorts`) | ❌ **Non** (Aucun fichier ni fonction backend) | ➖ Aucune méthode implémentée | ✅ Testé : Rejeté HTTP 400 | ❌ **NON FONCTIONNEL** | Le backend renvoie systématiquement `UNSUPPORTED_URL`. Proposer YouTube Shorts dans l'UI sans backend est trompeur. | ❌ **FAIL** |
| **X / Twitter** | ✅ Oui (Onglet "X", slug `x-video`) | ❌ **Non** (Aucun fichier ni fonction backend) | ➖ Aucune méthode implémentée | ✅ Testé : Rejeté HTTP 400 | ❌ **NON FONCTIONNEL** | Rejeté en HTTP 400 par le backend. X bloque tout scraping anonyme depuis 2023. | ❌ **FAIL** |
| **Facebook** | ✅ Oui (Onglet "Facebook", slug `facebook-reels`) | ❌ **Non** (Aucun fichier ni fonction backend) | ➖ Aucune méthode implémentée | ✅ Testé : Rejeté HTTP 400 | ❌ **NON FONCTIONNEL** | Rejeté en HTTP 400 par le backend. Nécessite une gestion complexe des cookies/tokens Meta. | ❌ **FAIL** |
| **Snapchat** | ✅ Oui (Onglet "Snapchat", slug `snapchat-spotlight`) | ❌ **Non** (Aucun fichier ni fonction backend) | ➖ Aucune méthode implémentée | ✅ Testé : Rejeté HTTP 400 | ❌ **NON FONCTIONNEL** | Rejeté en HTTP 400 par le backend. | ❌ **FAIL** |
| **Pinterest** | ❌ Non | ❌ Non | ➖ Aucune | ➖ Non testé | ❌ **NON FONCTIONNEL** | Aucun support prévu dans le code actuel. | ➖ **N/A** |
| **Reddit** | ❌ Non | ❌ Non | ➖ Aucune | ➖ Non testé | ❌ **NON FONCTIONNEL** | Aucun support prévu dans le code actuel. | ➖ **N/A** |
| **Threads** | ❌ Non | ❌ Non | ➖ Aucune | ➖ Non testé | ❌ **NON FONCTIONNEL** | Aucun support prévu dans le code actuel. | ➖ **N/A** |
| **Autres sites** | ❌ Non | ❌ Non | ➖ Aucune | ➖ Non testé | ❌ **NON FONCTIONNEL** | Seuls TikTok et Instagram sont routés. | ➖ **N/A** |

---

## 2. Analyse Approfondie du Parcours Utilisateur

### 2.1. Saisie et Détection d'URL
- **Champ d'entrée :** Le composant `HeroOmnibox.tsx` dispose d'une ergonomie soignée (détection en temps réel, support du bouton « Coller », touche Échap pour vider, autofocus sur grand écran).
- **Support des pseudonymes `@username` :** L'utilisateur peut saisir directement `@natgeo` ou `@username`. Le système client le convertit proprement en URL de profil pour Instagram ou TikTok.
- **Divergence Frontend / Backend :**
  - Le frontend valide les URLs de YouTube, X, Facebook et Snapchat grâce aux expressions régulières de `src/utils/urlDetector.ts`.
  - Lors de la soumission, l'appel API `GET /api/extract?url=...` atteint `functions/api/extract.ts`.
  - La fonction serveur appelle `functions/_lib/detect.ts` qui déclare strictement :
    ```typescript
    export type SupportedPlatform = 'tiktok' | 'instagram';
    ```
  - Toute URL YouTube, X, Facebook ou Snapchat est rejetée avec :
    ```json
    {
      "ok": false,
      "error": {
        "code": "UNSUPPORTED_URL",
        "message": "URL non supportée. VIDNEX prend en charge les vidéos/photos TikTok et les Reels/posts Instagram."
      }
    }
    ```
  - **Verdict :** Promesse utilisateur non tenue. 4 plateformes sur 6 affichées dans l'en-tête sont inopérantes.

### 2.2. Récupération des Métadonnées & Aperçus Médias
- **Instagram :**
  - Niveau 1 (Analyse embed captioned) : Extrait le nom d'utilisateur, la légende et la miniature. Si une vidéo publique est présente, extrait le flux MP4.
  - Si l'embed est restreint, bascule sur GraphQL ou exige `IG_SESSION_ID`.
  - Les aperçus d'images sont routés via `/api/download?url=...&inline=1` pour contourner les protections CORS et le référent d'Instagram.
- **TikTok :**
  - Résout les liens courts (`vm.tiktok.com`, `vt.tiktok.com`).
  - Extrait l'auteur, l'avatar, le titre descriptif, la miniature, la piste audio MP3 et le flux vidéo sans filigrane.

### 2.3. Formats et Qualités Proposés vs Réellement Disponibles
- **Vidéo :** Le tiroir de résultats (`ResultDrawer.tsx`) propose systématiquement :
  - Un bouton principal « Télécharger HD 1080p (Sans Filigrane) ».
  - Un bouton secondaire « Télécharger SD 720p ».
  - Un bouton « Extraire l'Audio (MP3) ».
- **Réalité des flux :**
  - Sur TikTok, le flux 1080p extrait est authentique lorsque fourni par TikWM (`hd=1`) ou dans `bitrateInfo`.
  - En revanche, la qualité « 720p » est souvent le même flux ré-étiqueté ou une estimation statique.
  - La mention « H.264 / AAC • 60fps » affichée dans la fiche technique est **statique et hardcodée** ; le flux réel dépend de l'encodage source de la plateforme.

### 2.4. Le Piège du Téléchargement Groupé Carrousel (.ZIP)
- L'interface d'un carrousel de photos affiche une grille de diapositives avec cases à cocher et un bouton :
  `Télécharger la sélection (N) .ZIP`
- Dans la version locale `ResultDrawer.tsx` (ligne 505) :
  ```typescript
  triggerNativeBackendDownload(
    `VIDNEX_${cleanHandle}_${selectedIds.length}_ITEMS.zip`,
    `/api/download?url=synthetic://carousel/archive.zip&filename=...`
  );
  ```
- **Ce qui se passe réellement :**
  1. Le navigateur appelle `/api/download?url=synthetic://carousel/archive.zip`.
  2. Le backend vérifie l'allowlist : le protocole `synthetic:` est rejeté.
  3. Le serveur renvoie HTTP 403 Forbidden avec `{ error: "Domaine média non autorisé : carousel." }`.
  4. Le navigateur télécharge un fichier nommé `VIDNEX_user_5_ITEMS.zip` contenant en réalité le texte JSON de l'erreur 403.
  5. L'utilisateur tente d'ouvrir l'archive avec WinRAR ou l'explorateur Windows, qui affiche : *« L'archive est endommagée ou d'un format inconnu »*.
- **Évolution dans origin/main :** Le commit `89608df` a remplacé l'appel `synthetic://` par des téléchargements séquentiels avec délai (`setTimeout(..., idx * 350)`), mais le bouton indique toujours `.ZIP`, provoquant l'ouverture multiple d'onglets ou le blocage par le bloqueur de popups du navigateur.

---

## 3. Gestion des Erreurs et Délais d'Attente

- **Codes d'erreur unifiés :** Le fichier `functions/_lib/normalize.ts` définit une typologie claire :
  - `UNSUPPORTED_URL` : Format ou plateforme non pris en charge.
  - `NOT_FOUND` : Contenu supprimé ou ID inexistant.
  - `PRIVATE_OR_LOGIN_REQUIRED` : Compte privé ou restriction d'âge.
  - `BLOCKED_BY_PLATFORM` : WAF TikTok ou limite de requêtes.
  - `TIMEOUT` : Délai d'attente dépassé (configuré à 8-10 secondes).
- **Anomalie HTTP :** Le backend renvoie souvent ces erreurs enveloppées dans une réponse HTTP 200 au lieu d'un statut HTTP 4xx ou 5xx approprié.

---

## 4. Checklist Fonctionnelle

- [x] Le champ URL accepte et valide les liens en temps réel.
- [x] La détection automatique de plateforme et du type de média fonctionne pour TikTok et Instagram.
- [x] Les erreurs de liens invalides sont signalées visuellement.
- [x] L'extraction de médias publics fonctionne sur TikTok (vidéos, photos, MP3).
- [x] L'extraction de médias publics fonctionne sur Instagram (Reels, posts image).
- [x] Les fichiers temporaires ne s'accumulent pas sur le serveur (architecture streaming direct zero-buffering).
- [ ] ❌ Absence complète de connecteur pour YouTube Shorts, X/Twitter, Facebook Reels et Snapchat.
- [ ] ❌ Le téléchargement groupé d'archive `.ZIP` est simulé ou déclenche des téléchargements multiples non groupés.
- [ ] ❌ Des métadonnées inventées (durée, followers, codecs) sont affichées comme authentiques.
- [ ] ❌ Les codes HTTP des erreurs d'extraction sont masqués sous un code 200 OK.
