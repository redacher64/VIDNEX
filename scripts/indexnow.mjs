#!/usr/bin/env node
/**
 * Script manuel de notification IndexNow (Bing, Yandex, Seznam, Naver).
 *
 * IMPORTANT :
 * - IndexNow notifie uniquement les moteurs participants (Bing, Yandex, etc.).
 * - Google N'UTILISE PAS le protocole IndexNow. Pour Google, soumettez votre
 *   sitemap (https://vidnex.space/sitemap.xml) dans Google Search Console.
 *
 * Utilisation après déploiement en production :
 *   node scripts/indexnow.mjs
 *   node scripts/indexnow.mjs --dry-run
 */

import { SITE_URL } from '../src/config/site.ts';
import { getAllPublicRoutes } from '../src/i18n/config.ts';

const INDEXNOW_KEY = 'vidnex2026indexnowkey9f8a7b6c5d4e3f2a1b0c';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const parsedSite = new URL(SITE_URL);
  const host = parsedSite.hostname;
  const keyLocation = `${SITE_URL}/${INDEXNOW_KEY}.txt`;

  const routes = getAllPublicRoutes();
  const urlList = routes.map((r) =>
    r.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${r.path}`
  );

  const payload = {
    host,
    key: INDEXNOW_KEY,
    keyLocation,
    urlList,
  };

  console.log('==========================================================');
  console.log('VIDNEX — Notification IndexNow (Bing / Yandex)');
  console.log('Note : IndexNow ne concerne PAS Google (utilisez Google Search Console).');
  console.log(`Domaine : ${host}`);
  console.log(`Clé     : ${keyLocation}`);
  console.log(`URLs    : ${urlList.length} pages publiques`);
  console.log('==========================================================');

  if (isDryRun) {
    console.log('[DRY-RUN] Payload JSON prêt à être envoyé :');
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  console.log(`Statut HTTP IndexNow : ${res.status} ${res.statusText}`);
  if (res.ok || res.status === 202) {
    console.log('Succès : les URLs ont été soumises à IndexNow (Bing/Yandex).');
  } else {
    const text = await res.text().catch(() => '');
    console.error('Réponse IndexNow :', text);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Erreur lors de la notification IndexNow :', err);
  process.exitCode = 1;
});
