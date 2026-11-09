# Guide d'Installation & Déploiement Cloudflare D1 (`SETUP.md`)

Ce guide contient les commandes exactes pour provisionner la base de données **Cloudflare D1** (100 % gratuite), appliquer la migration SQL initiale et configurer les secrets requis pour le panneau d'administration `/admin`.

---

## 1. Créer la base de données Cloudflare D1

Exécutez la commande suivante à la racine du projet :

```bash
npx wrangler d1 create vidnex-db
```

Wrangler affichera un bloc contenant un `database_id` (UUID). Copiez cet identifiant et remplacez la valeur `database_id` dans `wrangler.jsonc` :

```jsonc
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "vidnex-db",
      "database_id": "VOTRE-UUID-D1-ICI",
      "migrations_dir": "migrations"
    }
  ]
```

---

## 2. Appliquer la migration SQL (`migrations/0001_init.sql`)

### En local (pour tester avec Wrangler) :
```bash
npx wrangler d1 migrations apply vidnex-db --local
```

### En production (sur le réseau Cloudflare) :
```bash
npx wrangler d1 migrations apply vidnex-db --remote
```

---

## 3. Vérifier le Binding D1 dans le Dashboard Cloudflare

- **Si vous déployez sur Cloudflare Pages** :
  1. Ouvrez **Cloudflare Dashboard > Workers & Pages > Votre projet > Settings > Bindings** (ou *Functions > D1 database bindings*).
  2. Vérifiez qu'un binding de type **D1 database** nommé exactement **`DB`** pointe vers la base **`vidnex-db`** pour les environnements *Production* et *Preview*.
- **Si vous déployez en Worker avec Static Assets (`npx wrangler deploy`)** :
  Le bloc `d1_databases` présent dans `wrangler.jsonc` lie automatiquement `env.DB` lors du déploiement.

---

## 4. Configurer les Secrets Cloudflare (Obligatoire)

Aucun secret ne doit jamais figurer dans le code source ou dans le dépôt Git.

### A. Déploiement Cloudflare Pages (`wrangler pages secret put`)
```bash
# 1. Mot de passe de connexion au panneau /admin
npx wrangler pages secret put ADMIN_PASSWORD

# 2. Clé secrète HMAC-SHA256 pour signer le cookie de session (ex: openssl rand -hex 32)
npx wrangler pages secret put SESSION_SECRET

# 3. Sel cryptographique pour le hachage SHA-256 des adresses IP (ex: openssl rand -hex 16)
npx wrangler pages secret put IP_HASH_SALT

# 4. (Optionnel) Cookie de session d'un compte Instagram secondaire
npx wrangler pages secret put IG_SESSION_ID
```

### B. Déploiement Cloudflare Workers (`wrangler secret put`)
Si vous déployez directement via `npx wrangler deploy` (Workers + Static Assets) :
```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler secret put IP_HASH_SALT
# Optionnel :
npx wrangler secret put IG_SESSION_ID
```

---

## 5. Déployer l'application

```bash
npm run build
npx wrangler deploy
```

Une fois déployé, rendez-vous sur `https://vidnex.space/admin` et connectez-vous avec votre `ADMIN_PASSWORD`.
