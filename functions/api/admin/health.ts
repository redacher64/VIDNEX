import { type AdminEnv, getDb, getRawClientIp, hashIpAddress } from '../../_lib/db.ts';
import { verifyCsrfAndJson } from '../../_lib/auth.ts';
import { detectUrl } from '../../_lib/detect.ts';
import { extractTikTok } from '../../_lib/tiktok.ts';
import { extractInstagram } from '../../_lib/instagram.ts';
import { extractX, resolveTcoShortLink } from '../../_lib/x.ts';
import { extractFacebook, resolveFacebookRedirect } from '../../_lib/facebook.ts';
import { extractLinkedIn } from '../../_lib/linkedin.ts';
import { getSystemSettings, updateSystemSettings } from '../../_lib/settings.ts';
import { logExtractionEvent, recordEngineHealthTest } from '../../_lib/logger.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv & {
    IG_SESSION_ID?: string;
    IG_CSRF_TOKEN?: string;
    IG_COOKIES?: string;
    TIKWM_API_KEY?: string;
    TT_COOKIE?: string;
  };
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const env = context.env || {};
  const db = getDb(env);
  const settings = await getSystemSettings(env);

  const igCookieConfigured = Boolean(
    (env.IG_SESSION_ID && env.IG_SESSION_ID.trim().length > 0) ||
      (env.IG_COOKIES && env.IG_COOKIES.trim().length > 0)
  );

  const defaultEngines = {
    tiktok: {
      platform: 'tiktok',
      last_success_ts: null as number | null,
      last_test_ts: null as number | null,
      last_test_ok: null as number | null,
      last_error_code: null as string | null,
      test_url: settings.test_url_tiktok || '',
    },
    instagram: {
      platform: 'instagram',
      last_success_ts: null as number | null,
      last_test_ts: null as number | null,
      last_test_ok: null as number | null,
      last_error_code: null as string | null,
      test_url: settings.test_url_instagram || '',
    },
    instagram_profile: {
      platform: 'instagram_profile',
      last_success_ts: null as number | null,
      last_test_ts: null as number | null,
      last_test_ok: null as number | null,
      last_error_code: null as string | null,
      test_url: settings.test_url_instagram_profile || '',
    },
    x: {
      platform: 'x',
      last_success_ts: null as number | null,
      last_test_ts: null as number | null,
      last_test_ok: null as number | null,
      last_error_code: null as string | null,
      test_url: settings.test_url_x || '',
    },
    facebook: {
      platform: 'facebook',
      last_success_ts: null as number | null,
      last_test_ts: null as number | null,
      last_test_ok: null as number | null,
      last_error_code: null as string | null,
      test_url: settings.test_url_facebook || '',
    },
    linkedin: {
      platform: 'linkedin',
      last_success_ts: null as number | null,
      last_test_ts: null as number | null,
      last_test_ok: null as number | null,
      last_error_code: null as string | null,
      test_url: settings.test_url_linkedin || '',
    },
  };

  if (db) {
    try {
      const res = await db
        .prepare(
          'SELECT platform, last_success_ts, last_test_ts, last_test_ok, last_error_code FROM engine_status'
        )
        .all<{
          platform: string;
          last_success_ts: number | null;
          last_test_ts: number | null;
          last_test_ok: number | null;
          last_error_code: string | null;
        }>();

      for (const row of res.results || []) {
        if (
          row.platform === 'tiktok' ||
          row.platform === 'instagram' ||
          row.platform === 'instagram_profile' ||
          row.platform === 'x' ||
          row.platform === 'facebook' ||
          row.platform === 'linkedin'
        ) {
          defaultEngines[row.platform] = {
            ...defaultEngines[row.platform],
            last_success_ts: row.last_success_ts,
            last_test_ts: row.last_test_ts,
            last_test_ok: row.last_test_ok,
            last_error_code: row.last_error_code,
          };
        }
      }
    } catch {
      // Ignore if D1 fails
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      engines: defaultEngines,
      instagramCookie: {
        configured: igCookieConfigured,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    }
  );
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env = {} } = context;

  const csrf = verifyCsrfAndJson(request);
  if (!csrf.ok) {
    return new Response(JSON.stringify({ ok: false, message: csrf.error }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const db = getDb(env);
  let body: {
    action?: 'test_engine' | 'test_ig_cookie';
    platform?:
      | 'tiktok'
      | 'instagram'
      | 'instagram_profile'
      | 'x'
      | 'facebook'
      | 'linkedin';
    url?: string;
  } = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // Action 1 : Test réel du cookie Instagram (sans JAMAIS renvoyer la valeur du secret)
  if (body.action === 'test_ig_cookie') {
    const configured = Boolean(
      (env.IG_SESSION_ID && env.IG_SESSION_ID.trim().length > 0) ||
        (env.IG_COOKIES && env.IG_COOKIES.trim().length > 0)
    );

    if (!configured) {
      return new Response(
        JSON.stringify({
          ok: true,
          configured: false,
          valid: false,
          message:
            'Aucun cookie Instagram (IG_SESSION_ID ou IG_COOKIES) n’est défini dans les secrets Cloudflare.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        }
      );
    }

    const startedAt = Date.now();
    const probe = await extractInstagram('instagram', env, 'profile');
    const durationMs = Date.now() - startedAt;

    return new Response(
      JSON.stringify({
        ok: true,
        configured: true,
        valid: probe.ok,
        durationMs,
        errorCode: probe.error?.code || null,
        message: probe.ok
          ? `Cookie Instagram défini et opérationnel (${durationMs} ms).`
          : `Cookie défini, mais le test a renvoyé ${probe.error?.code || 'une erreur'} (${probe.error?.message || 'échec'}).`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    );
  }

  // Action 2 : Test réel d'un moteur sur l'URL saisie par l'admin (aucune URL en dur)
  const platform = body.platform;
  const testUrl = (body.url || '').trim();

  if (
    platform !== 'tiktok' &&
    platform !== 'instagram' &&
    platform !== 'instagram_profile' &&
    platform !== 'x' &&
    platform !== 'facebook' &&
    platform !== 'linkedin'
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        message:
          'Plateforme invalide (tiktok, instagram, instagram_profile, x, facebook ou linkedin requis).',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    );
  }

  if (!testUrl) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: 'Veuillez saisir une URL de test réelle avant de lancer la vérification.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    );
  }

  // Sauvegarde de l'URL de test saisie par l'admin dans settings
  if (db) {
    await updateSystemSettings(
      env,
      platform === 'tiktok'
        ? { test_url_tiktok: testUrl }
        : platform === 'instagram'
        ? { test_url_instagram: testUrl }
        : platform === 'instagram_profile'
        ? { test_url_instagram_profile: testUrl }
        : platform === 'x'
        ? { test_url_x: testUrl }
        : platform === 'linkedin'
        ? { test_url_linkedin: testUrl }
        : { test_url_facebook: testUrl }
    );
  }

  const detectPreferred =
    platform === 'instagram_profile' ? 'instagram' : platform;
  let detection = detectUrl(testUrl, detectPreferred);
  if (detection.isValid && detection.platform === 'x' && detection.isShortLink) {
    const resolved = await resolveTcoShortLink(detection.cleanUrl);
    if (resolved) {
      detection = detectUrl(resolved, 'x');
    } else {
      detection = { ...detection, isValid: false };
    }
  } else if (detection.isValid && detection.platform === 'facebook' && detection.isShortLink) {
    const resolved = await resolveFacebookRedirect(detection.cleanUrl);
    if (resolved.ok && resolved.finalUrl) {
      detection = detectUrl(resolved.finalUrl, 'facebook');
    } else {
      const errCode = resolved.errorCode || 'UNSUPPORTED_URL';
      await recordEngineHealthTest(env, 'facebook', false, errCode);
      return new Response(
        JSON.stringify({
          ok: false,
          testOk: false,
          errorCode: errCode,
          message:
            resolved.errorMessage || "Impossible de résoudre l'URL courte Facebook.",
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        }
      );
    }
  }

  if (detection.platform === 'facebook' && detection.isLoginRedirect) {
    await recordEngineHealthTest(env, 'facebook', false, 'PRIVATE_OR_LOGIN_REQUIRED');
    return new Response(
      JSON.stringify({
        ok: false,
        testOk: false,
        errorCode: 'PRIVATE_OR_LOGIN_REQUIRED',
        message:
          "Cette vidéo n'est pas publique ou Facebook demande une connexion. Seules les vidéos publiques peuvent être téléchargées.",
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    );
  }

  const isValidForTarget =
    platform === 'instagram_profile'
      ? detection.isValid &&
        detection.platform === 'instagram' &&
        detection.kind === 'profile'
      : detection.isValid && detection.platform === platform;

  if (!isValidForTarget) {
    await recordEngineHealthTest(env, platform, false, 'UNSUPPORTED_URL');
    const label =
      platform === 'tiktok'
        ? 'TikTok'
        : platform === 'instagram'
        ? 'Instagram'
        : platform === 'instagram_profile'
        ? 'de profil Instagram'
        : platform === 'x'
        ? 'X (Twitter)'
        : platform === 'linkedin'
        ? 'de profil LinkedIn (/in/{slug})'
        : 'Facebook';
    return new Response(
      JSON.stringify({
        ok: false,
        testOk: false,
        errorCode: 'UNSUPPORTED_URL',
        message: `L'URL saisie n'est pas une URL ${label} valide.`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    );
  }

  const startedAt = Date.now();
  const result =
    platform === 'tiktok'
      ? await extractTikTok(
          detection.cleanUrl,
          env,
          detection.kind === 'profile' ? 'profile' : 'video',
          detection.identifier
        )
      : platform === 'instagram_profile'
      ? await extractInstagram(detection.identifier || '', env, 'profile')
      : platform === 'instagram'
      ? await extractInstagram(
          detection.identifier || '',
          env,
          detection.kind === 'profile'
            ? 'profile'
            : detection.kind === 'story'
            ? 'story'
            : 'post'
        )
      : platform === 'x'
      ? await extractX(detection.identifier || '')
      : platform === 'linkedin'
      ? await extractLinkedIn(detection.identifier || '')
      : await extractFacebook(detection.cleanUrl, detection.identifier);

  const durationMs = Date.now() - startedAt;
  const testOk = Boolean(result.ok && !result.error);
  const errorCode = testOk ? null : result.error?.code || 'BLOCKED_BY_PLATFORM';

  await recordEngineHealthTest(env, platform, testOk, errorCode);

  const rawIp = getRawClientIp(request);
  const ipHash = await hashIpAddress(rawIp, env.IP_HASH_SALT);
  await logExtractionEvent(env, {
    platform,
    status: testOk ? 'success' : 'error',
    errorCode,
    durationMs,
    ipHash,
    engineStage: result.engineStage || null,
    httpStatus: result.httpStatus ?? null,
  });

  return new Response(
    JSON.stringify({
      ok: true,
      platform,
      testOk,
      durationMs,
      itemsCount: result.items?.length || 0,
      errorCode,
      message: testOk
        ? `Extraction réussie en ${durationMs} ms (${result.items?.length || 0} média(s) détecté(s)).`
        : result.error?.message || `Échec de l'extraction (${errorCode}).`,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    }
  );
}
