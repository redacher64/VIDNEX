import {
  onRequestGet as extractGet,
  onRequestPost as extractPost,
  onRequestOptions as extractOptions,
} from './functions/api/extract.ts';
import {
  onRequestGet as downloadGet,
  onRequestOptions as downloadOptions,
} from './functions/api/download.ts';

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/extract') {
      if (request.method === 'OPTIONS') return extractOptions();
      if (request.method === 'GET') {
        return extractGet({
          request,
          env: env || {},
          params: {},
          waitUntil: ctx?.waitUntil ? ctx.waitUntil.bind(ctx) : () => {},
          next: () => Promise.resolve(new Response(null)),
          data: {},
        } as any);
      }
      if (request.method === 'POST') {
        return extractPost({
          request,
          env: env || {},
          params: {},
          waitUntil: ctx?.waitUntil ? ctx.waitUntil.bind(ctx) : () => {},
          next: () => Promise.resolve(new Response(null)),
          data: {},
        } as any);
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (url.pathname === '/api/download') {
      if (request.method === 'OPTIONS') return downloadOptions();
      if (request.method === 'GET' || request.method === 'HEAD') {
        return downloadGet({
          request,
          env: env || {},
          params: {},
          waitUntil: ctx?.waitUntil ? ctx.waitUntil.bind(ctx) : () => {},
          next: () => Promise.resolve(new Response(null)),
          data: {},
        } as any);
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          platform: 'cloudflare-pages-functions',
          engines: ['tiktok_tikwm_and_html', 'instagram_embed_graphql_and_session'],
          igAccountConnected: Boolean(env?.IG_SESSION_ID),
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
    if (env?.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
