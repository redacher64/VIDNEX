/**
 * Moteur d'extraction TikTok 100 % gratuit SANS API TIERCE.
 * 
 * Fonctionnement :
 * 1. Résolution des redirections pour les liens courts (vm.tiktok.com, vt.tiktok.com).
 * 2. Récupération de la page HTML officielle avec User-Agent navigateur réaliste et conservation des cookies.
 * 3. Analyse du JSON embarqué (__UNIVERSAL_DATA_FOR_REHYDRATION__, SIGI_STATE, ou __NEXT_DATA__).
 * 4. Extraction du flux vidéo haute qualité sans filigrane, de l'audio MP3, de la cover et des carrousels photos.
 */

import { fetchWithContext } from './http.ts';
import type { ExtractResponse, ExtractMediaItem } from './normalize.ts';

export async function extractTikTok(targetUrl: string): Promise<ExtractResponse> {
  try {
    // 1. Suivre les redirections (pour les liens courts vm.tiktok.com / vt.tiktok.com)
    const initialFetch = await fetchWithContext(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'Referer': 'https://www.tiktok.com/',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (initialFetch.response.status === 404) {
      return {
        ok: false,
        platform: 'tiktok',
        error: {
          code: 'NOT_FOUND',
          message: 'Cette vidéo TikTok est introuvable ou a été supprimée.',
        },
      };
    }

    const html = await initialFetch.response.text();

    // 2. Détection de blocage ou captcha
    if (
      html.includes('verify-bar') ||
      html.includes('captcha-disable') ||
      html.includes('slardar') ||
      html.includes('SlardarWAF') ||
      html.includes('_wafchallengeid') ||
      initialFetch.response.status === 403
    ) {
      return {
        ok: false,
        platform: 'tiktok',
        error: {
          code: 'BLOCKED_BY_PLATFORM',
          message:
            'TikTok a temporairement activé un contrôle de sécurité (WAF). Veuillez réessayer dans quelques instants.',
        },
      };
    }

    // 3. Extraction du JSON de réhydratation
    let itemStruct: any = null;

    // A. __UNIVERSAL_DATA_FOR_REHYDRATION__ (Format standard actuel)
    const universalMatch = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i
    );
    if (universalMatch?.[1]) {
      try {
        const parsed = JSON.parse(universalMatch[1]);
        const defaultScope = parsed['__DEFAULT_SCOPE__'] || {};
        const videoDetail = defaultScope['webapp.video-detail'] || {};
        itemStruct = videoDetail.itemInfo?.itemStruct;
      } catch {
        // Poursuivre vers les autres formats
      }
    }

    // B. SIGI_STATE (Format alternatif)
    if (!itemStruct) {
      const sigiMatch = html.match(
        /<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/i
      );
      if (sigiMatch?.[1]) {
        try {
          const parsed = JSON.parse(sigiMatch[1]);
          const itemModule = parsed.ItemModule || {};
          const firstKey = Object.keys(itemModule)[0];
          if (firstKey) {
            itemStruct = itemModule[firstKey];
          }
        } catch {
          // Poursuivre
        }
      }
    }

    // C. __NEXT_DATA__
    if (!itemStruct) {
      const nextMatch = html.match(
        /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i
      );
      if (nextMatch?.[1]) {
        try {
          const parsed = JSON.parse(nextMatch[1]);
          itemStruct = parsed.props?.pageProps?.itemInfo?.itemStruct;
        } catch {
          // Poursuivre
        }
      }
    }

    if (!itemStruct) {
      return {
        ok: false,
        platform: 'tiktok',
        error: {
          code: 'NOT_FOUND',
          message:
            'Impossible de lire les métadonnées de la vidéo TikTok. Le contenu est peut-être restreint ou introuvable.',
        },
      };
    }

    // 4. Vérification contenu privé
    if (itemStruct.privateItem === true || itemStruct.secret === true) {
      return {
        ok: false,
        platform: 'tiktok',
        error: {
          code: 'PRIVATE_OR_LOGIN_REQUIRED',
          message: 'Cette vidéo TikTok provient d\'un compte privé ou est restreinte.',
        },
      };
    }

    const author = itemStruct.author || {};
    const username = String(author.uniqueId || 'tiktok_user').replace(/^@/, '');
    const nickname = String(author.nickname || `@${username}`);
    const avatar = String(author.avatarLarger || author.avatarMedium || author.avatarThumb || '');
    const title = String(itemStruct.desc || itemStruct.title || `Vidéo TikTok de @${username}`);
    const cover = String(
      itemStruct.video?.originCover ||
      itemStruct.video?.cover ||
      itemStruct.video?.dynamicCover ||
      avatar
    );

    const items: ExtractMediaItem[] = [];

    // 5. Cas Carrousel photo (Photo Slideshow Mode)
    if (Array.isArray(itemStruct.imagePost?.images) && itemStruct.imagePost.images.length > 0) {
      itemStruct.imagePost.images.forEach((img: any, idx: number) => {
        const imgUrl =
          img.displayImage?.urlList?.[0] ||
          img.thumbnail?.urlList?.[0] ||
          img.urlList?.[0];
        if (imgUrl) {
          items.push({
            kind: 'image',
            url: imgUrl,
            quality: 'HD',
            ext: 'jpg',
          });
        }
      });

      // Piste audio MP3 associée
      if (itemStruct.music?.playUrl) {
        items.push({
          kind: 'audio',
          url: itemStruct.music.playUrl,
          quality: 'Original MP3',
          ext: 'mp3',
        });
      }

      return {
        ok: true,
        platform: 'tiktok',
        type: 'carousel',
        title,
        author: {
          username,
          nickname,
          avatar,
        },
        thumbnail: cover,
        items,
      };
    }

    // 6. Cas Vidéo standard : flux sans filigrane
    const video = itemStruct.video || {};

    // Trouver l'URL de lecture directe sans filigrane
    let videoStreamUrl =
      video.playAddr ||
      video.downloadAddr ||
      '';

    // Explorer bitrateInfo pour la meilleure qualité disponible (1080p / 720p)
    if (Array.isArray(video.bitrateInfo) && video.bitrateInfo.length > 0) {
      // Priorité à la résolution la plus élevée (adapt_lowest_1080_1, etc.)
      const bestBitrate = video.bitrateInfo[0];
      const candidate = bestBitrate?.PlayAddr?.UrlList?.[0];
      if (candidate) {
        videoStreamUrl = candidate;
      }
    }

    if (!videoStreamUrl) {
      return {
        ok: false,
        platform: 'tiktok',
        error: {
          code: 'NOT_FOUND',
          message: 'Flux vidéo introuvable dans la publication TikTok.',
        },
      };
    }

    // Format HD 1080p sans filigrane
    items.push({
      kind: 'video',
      url: videoStreamUrl,
      quality: '1080p (No Watermark)',
      ext: 'mp4',
      width: video.width || 1080,
      height: video.height || 1920,
    });

    // Piste audio MP3
    if (itemStruct.music?.playUrl) {
      items.push({
        kind: 'audio',
        url: itemStruct.music.playUrl,
        quality: 'Audio MP3',
        ext: 'mp3',
      });
    }

    return {
      ok: true,
      platform: 'tiktok',
      type: 'video',
      title,
      author: {
        username,
        nickname,
        avatar,
      },
      thumbnail: cover,
      items,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return {
        ok: false,
        platform: 'tiktok',
        error: {
          code: 'TIMEOUT',
          message: 'Le délai d\'attente a expiré lors de la connexion à TikTok.',
        },
      };
    }
    return {
      ok: false,
      platform: 'tiktok',
      error: {
        code: 'BLOCKED_BY_PLATFORM',
        message:
          err instanceof Error
            ? `Erreur lors de l'extraction TikTok : ${err.message}`
            : 'Erreur inattendue lors de l\'extraction TikTok.',
      },
    };
  }
}
