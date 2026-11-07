/**
 * Moteur d'extraction Instagram SANS API TIERCE (RapidAPI / Cobalt interdits).
 * 
 * Architecture en 2 niveaux :
 * - Niveau 1 (100 % gratuit sans compte) : Analyse de la page embed officielle /p/{shortcode}/embed/captioned/
 * - Niveau 2 (optionnel) : Si le secret IG_SESSION_ID est configuré dans Cloudflare Pages,
 *   exécution d'une requête authentifiée avec le cookie sessionid pour les publications que le niveau 1 n'a pas pu lire.
 * - Transparence : Si Instagram bloque la lecture publique sans session, l'erreur est explicitement rapportée.
 */

import { fetchWithContext } from './http.ts';
import type { ExtractResponse, ExtractMediaItem } from './normalize.ts';

function cleanEscapedUrl(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\u0026/g, '&')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');
}

export async function extractInstagram(
  shortcode: string,
  env?: { IG_SESSION_ID?: string }
): Promise<ExtractResponse> {
  // -------------------------------------------------------------
  // NIVEAU 1 : Analyse de l'embed captioned officiel (sans compte)
  // -------------------------------------------------------------
  try {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    const embedFetch = await fetchWithContext(embedUrl, {
      headers: {
        Referer: 'https://www.instagram.com/',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
      },
    });

    if (embedFetch.response.status === 404) {
      return {
        ok: false,
        platform: 'instagram',
        error: {
          code: 'NOT_FOUND',
          message: 'Cette publication Instagram est introuvable ou a été supprimée.',
        },
      };
    }

    const html = await embedFetch.response.text();

    // Recherche de métadonnées dans l'embed HTML
    const usernameMatch =
      html.match(/\\"username\\":\\"([^\\"]+)\\"/) ||
      html.match(/"username":"([^"]+)"/) ||
      html.match(/class="UsernameText"[^>]*>([^<]+)</i);
    const username = (usernameMatch?.[1] || 'instagram_user').replace(/^@/, '');

    const captionMatch =
      html.match(/class="Caption"[^>]*>[\s\S]*?<br\s*\/?>([\s\S]*?)<\/div>/i) ||
      html.match(/\\"caption\\":\\"([^\\"]+)\\"/);
    const title = captionMatch?.[1]
      ? captionMatch[1].replace(/<[^>]+>/g, '').trim()
      : `Publication Instagram (${shortcode})`;

    const videoUrlMatch =
      html.match(/\\"video_url\\":\\"([^\\"]+)\\"/) ||
      html.match(/"video_url":"([^"]+)"/);

    const displayUrlMatch =
      html.match(/\\"display_url\\":\\"([^\\"]+)\\"/) ||
      html.match(/"display_url":"([^"]+)"/) ||
      html.match(/class="EmbeddedMediaImage"[^>]+src="([^"]+)"/i);

    if (videoUrlMatch?.[1]) {
      const videoUrl = cleanEscapedUrl(videoUrlMatch[1]);
      const displayUrl = displayUrlMatch?.[1] ? cleanEscapedUrl(displayUrlMatch[1]) : videoUrl;

      return {
        ok: true,
        platform: 'instagram',
        type: 'video',
        title,
        author: {
          username,
          nickname: `@${username}`,
        },
        thumbnail: displayUrl,
        items: [
          {
            kind: 'video',
            url: videoUrl,
            quality: '1080p HD',
            ext: 'mp4',
          },
        ],
      };
    }

    if (displayUrlMatch?.[1]) {
      const displayUrl = cleanEscapedUrl(displayUrlMatch[1]);
      return {
        ok: true,
        platform: 'instagram',
        type: 'image',
        title,
        author: {
          username,
          nickname: `@${username}`,
        },
        thumbnail: displayUrl,
        items: [
          {
            kind: 'image',
            url: displayUrl,
            quality: 'HD Image',
            ext: 'jpg',
          },
        ],
      };
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return {
        ok: false,
        platform: 'instagram',
        error: {
          code: 'TIMEOUT',
          message: 'Le délai d\'attente a expiré lors de la connexion à Instagram.',
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // NIVEAU 2 : Requête authentifiée (optionnel via env.IG_SESSION_ID)
  // --------------------------------------------------------------------------
  const sessionId = env?.IG_SESSION_ID?.trim();
  if (sessionId) {
    try {
      const directUrl = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
      const sessionFetch = await fetchWithContext(directUrl, {
        headers: {
          Cookie: `sessionid=${sessionId};`,
          Referer: `https://www.instagram.com/p/${shortcode}/`,
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (sessionFetch.response.ok) {
        const json: any = await sessionFetch.response.json().catch(() => null);
        const item = json?.items?.[0] || json?.graphql?.shortcode_media;

        if (item) {
          const username =
            item.user?.username || item.owner?.username || 'instagram_user';
          const caption =
            item.caption?.text ||
            item.edge_media_to_caption?.edges?.[0]?.node?.text ||
            `Publication Instagram (${shortcode})`;

          const isVideo = Boolean(item.video_versions?.length || item.is_video);

          if (isVideo) {
            const videoUrl =
              item.video_versions?.[0]?.url || item.video_url;
            const coverUrl =
              item.image_versions2?.candidates?.[0]?.url || item.display_url;

            if (videoUrl) {
              return {
                ok: true,
                platform: 'instagram',
                type: 'video',
                title: caption,
                author: {
                  username,
                  nickname: `@${username}`,
                },
                thumbnail: coverUrl || videoUrl,
                items: [
                  {
                    kind: 'video',
                    url: videoUrl,
                    quality: 'HD 1080p',
                    ext: 'mp4',
                  },
                ],
              };
            }
          }

          // Carrousel de médias
          const carouselMedia =
            item.carousel_media ||
            item.edge_sidecar_to_children?.edges?.map((e: any) => e.node);

          if (Array.isArray(carouselMedia) && carouselMedia.length > 0) {
            const items: ExtractMediaItem[] = [];
            carouselMedia.forEach((media: any) => {
              const vidUrl =
                media.video_versions?.[0]?.url || media.video_url;
              const imgUrl =
                media.image_versions2?.candidates?.[0]?.url ||
                media.display_url;

              if (vidUrl) {
                items.push({
                  kind: 'video',
                  url: vidUrl,
                  quality: 'HD',
                  ext: 'mp4',
                });
              } else if (imgUrl) {
                items.push({
                  kind: 'image',
                  url: imgUrl,
                  quality: 'HD',
                  ext: 'jpg',
                });
              }
            });

            return {
              ok: true,
              platform: 'instagram',
              type: 'carousel',
              title: caption,
              author: {
                username,
                nickname: `@${username}`,
              },
              thumbnail: items[0]?.url,
              items,
            };
          }

          // Image unique
          const imageUrl =
            item.image_versions2?.candidates?.[0]?.url || item.display_url;
          if (imageUrl) {
            return {
              ok: true,
              platform: 'instagram',
              type: 'image',
              title: caption,
              author: {
                username,
                nickname: `@${username}`,
              },
              thumbnail: imageUrl,
              items: [
                {
                  kind: 'image',
                  url: imageUrl,
                  quality: 'HD Image',
                  ext: 'jpg',
                },
              ],
            };
          }
        }
      }
    } catch {
      // Échec Niveau 2, continuer vers le rapport honnête
    }
  }

  // -------------------------------------------------------------
  // RAPPORT HONNÊTE : Instagram bloque la lecture publique directe
  // -------------------------------------------------------------
  return {
    ok: false,
    platform: 'instagram',
    error: {
      code: 'PRIVATE_OR_LOGIN_REQUIRED',
      message:
        'Instagram restreint l\'accès à cette publication sans compte connecté. ' +
        (sessionId
          ? 'La session IG_SESSION_ID configurée a expiré ou est invalide.'
          : 'Pour activer l\'extraction Instagram avancée, configurez le secret IG_SESSION_ID dans Cloudflare Pages.'),
    },
  };
}
