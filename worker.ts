import {
  onRequestGet as extractGet,
  onRequestPost as extractPost,
  onRequestOptions as extractOptions,
  type Env as ExtractEnv,
} from './functions/api/extract.ts';
import {
  onRequestGet as downloadGet,
  onRequestOptions as downloadOptions,
} from './functions/api/download.ts';

export interface WorkerEnv extends ExtractEnv {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
  [key: string]: unknown;
}

export default {
  async fetch(
    request: Request,
    env: WorkerEnv = {}
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/extract') {
      if (request.method === 'OPTIONS') return extractOptions();
      if (request.method === 'GET') {
        return extractGet({
          request,
          env,
        });
      }
      if (request.method === 'POST') {
        return extractPost({
          request,
          env,
        });
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (url.pathname === '/api/download') {
      if (request.method === 'OPTIONS') return downloadOptions();
      if (request.method === 'GET' || request.method === 'HEAD') {
        return downloadGet({
          request,
          env: {
            IG_SESSION_ID: env.IG_SESSION_ID,
            IG_CSRF_TOKEN: env.IG_CSRF_TOKEN,
            IG_COOKIES: env.IG_COOKIES,
            TIKWM_API_KEY: env.TIKWM_API_KEY,
            TT_COOKIE: env.TT_COOKIE,
          },
        });
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          platform: 'cloudflare-pages-functions',
          engines: ['tiktok_tikwm_and_html', 'instagram_embed_graphql_and_session'],
          igAccountConnected: Boolean(env.IG_SESSION_ID || env.IG_COOKIES),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Static assets fallback via Cloudflare Workers Static Assets binding
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
