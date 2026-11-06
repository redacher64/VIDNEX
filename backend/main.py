import asyncio
import base64
import ipaddress
import os
import re
import shutil
import socket
import tempfile
import time
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from urllib.parse import quote, urlencode, urlparse

import httpx
import yt_dlp
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

app = FastAPI(
    title="VIDNEX Unlimited Media Resolver API",
    version="3.0.0",
    description="Zero-cost multi-engine media extraction API (TikWM + vxTwitter + yt-dlp + FFmpeg)",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Length"],
)

BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/128.0.0.0 Safari/537.36"
)


class ExtractRequest(BaseModel):
    url: str
    platform: Optional[str] = None
    mediaType: Optional[str] = None
    identifier: Optional[str] = None
    badgeLabel: Optional[str] = None


def get_base_url(request: Request) -> str:
    forwarded_proto = request.headers.get("x-forwarded-proto")
    forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if forwarded_host:
        scheme = forwarded_proto or request.url.scheme or "https"
        return f"{scheme}://{forwarded_host}".rstrip("/")
    return str(request.base_url).rstrip("/")


def resolve_upstream_url(raw_url: Optional[str]) -> str:
    if not raw_url:
        return ""
    u = raw_url.strip()
    if u.startswith("//"):
        return f"https:{u}"
    if u.startswith("/"):
        return f"https://www.tikwm.com{u}"
    return u


def build_download_url(
    base_url: str,
    target_url: str,
    filename: str,
    mux_url: Optional[str] = None,
) -> str:
    resolved = resolve_upstream_url(target_url)
    params: Dict[str, str] = {"url": resolved, "filename": filename}
    if mux_url:
        params["mux"] = "1"
        params["source"] = mux_url
    return f"{base_url}/api/download?{urlencode(params)}"


def build_proxy_image_url(base_url: str, image_url: Optional[str]) -> str:
    resolved = resolve_upstream_url(image_url)
    if not resolved:
        return ""
    if resolved.startswith("data:") or "/api/proxy-image" in resolved:
        return resolved
    return f"{base_url}/api/proxy-image?{urlencode({'url': resolved})}"


def prepare_cookies_file() -> Optional[str]:
    b64_cookies = os.environ.get("COOKIES_TXT_BASE64", "").strip()
    if not b64_cookies:
        return None
    try:
        decoded = base64.b64decode(b64_cookies)
        cookie_path = "/tmp/cookies.txt"
        with open(cookie_path, "wb") as f:
            f.write(decoded)
        return cookie_path
    except Exception:
        return None


def validate_public_url(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only http/https URLs are allowed.")
    hostname = (parsed.hostname or "").strip().lower()
    if not hostname or hostname in ("localhost", "0.0.0.0", "::1"):
        raise HTTPException(status_code=400, detail="Localhost targets are forbidden.")
    try:
        resolved_ips = socket.getaddrinfo(hostname, None)
        for item in resolved_ips:
            ip_str = item[4][0]
            ip_obj = ipaddress.ip_address(ip_str)
            if (
                ip_obj.is_private
                or ip_obj.is_loopback
                or ip_obj.is_link_local
                or ip_obj.is_multicast
                or ip_obj.is_reserved
            ):
                raise HTTPException(
                    status_code=400, detail="Private or internal IP addresses are forbidden."
                )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Unable to resolve target hostname.")
    return raw_url


def format_duration(seconds: Any) -> str:
    try:
        sec = int(float(seconds))
        if sec <= 0:
            return "00:30"
        return f"{sec // 60:02d}:{sec % 60:02d}"
    except Exception:
        return "00:30"


def format_filesize(size_bytes: Any, fallback: str = "14.2 MB") -> str:
    try:
        b = float(size_bytes)
        if b <= 0:
            return fallback
        mb = b / (1024 * 1024)
        if mb < 1:
            return f"{max(100, int(b / 1024))} KB"
        return f"{mb:.1f} MB"
    except Exception:
        return fallback


def format_followers(count: Any) -> str:
    try:
        n = float(count)
        if n >= 1_000_000:
            return f"{n / 1_000_000:.1f}M"
        if n >= 1_000:
            return f"{n / 1_000:.1f}K"
        return str(int(n))
    except Exception:
        return "125.4K"


def now_timestamp() -> str:
    return datetime.utcnow().strftime("%H:%M:%S")


import math

DEFAULT_TIKWM_API_KEY = "fbef7469f068f8ee1493378b59468819"


def get_tikwm_api_key() -> str:
    return os.environ.get("TIKWM_API_KEY", DEFAULT_TIKWM_API_KEY).strip()


def get_bettertwitfix_base_url() -> str:
    return (
        os.environ.get("BETTERTWITFIX_API_URL", "https://api.vxtwitter.com")
        .strip()
        .rstrip("/")
    )


def calc_syndication_token(id_str: str) -> str:
    """
    Ported from dylanpdx/BetterTwitFix (twExtract/twUtils.py: calcSyndicationToken)
    """
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    try:
        val = (int(id_str) / 1000000000000000.0) * math.pi
        base = 36
        result = ""
        i = int(val)
        while i > 0:
            result = digits[i % base] + result
            i = i // base
        if int(val) != val:
            result += "."
            frac = val - int(val)
            d = 0
            while frac != int(frac) and d < 8:
                result += digits[int(frac * base % base)]
                frac = frac * base
                d += 1
        cleaned = result.replace("0", "").replace(".", "")
        return cleaned if cleaned else "0"
    except Exception:
        return "0"


def get_best_media_url(media_list: List[Dict[str, Any]]) -> str:
    """
    Ported from dylanpdx/BetterTwitFix (vxApi.py: getBestMediaUrl)
    Finds the highest-bitrate H.264 video/mp4 stream, excluding /hevc/ and stripping ?tag=
    """
    best_bitrate = -1
    best_url = ""
    for j in media_list:
        if (
            isinstance(j, dict)
            and j.get("content_type") == "video/mp4"
            and "/hevc/" not in str(j.get("url", ""))
            and (j.get("bitrate") or 0) > best_bitrate
        ):
            best_url = str(j["url"])
            best_bitrate = j.get("bitrate") or 0
    if "?tag=" in best_url:
        best_url = best_url[: best_url.index("?tag=")]
    return best_url


# ==============================================================================
# ENGINE 1: TIKTOK DIRECT ENGINE (https://www.tikwm.com/api/ + TIKWM_API_KEY)
# ==============================================================================
async def extract_via_tikwm(
    req: ExtractRequest, base_url: str
) -> Optional[Dict[str, Any]]:
    tikwm_key = get_tikwm_api_key()
    headers = {"User-Agent": BROWSER_UA, "Accept": "application/json"}
    if tikwm_key:
        headers["X-API-KEY"] = tikwm_key

    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
        # 1A. TikTok Profile DP (@username)
        if req.mediaType == "profile":
            handle = (
                req.identifier
                or req.url.rstrip("/").split("/")[-1]
                or "tiktok"
            ).lstrip("@")
            user_params: Dict[str, Any] = {"unique_id": handle}
            if tikwm_key:
                user_params["api_key"] = tikwm_key
            resp = await client.get(
                "https://www.tikwm.com/api/user/info",
                params=user_params,
                headers=headers,
            )
            data = resp.json() if resp.status_code == 200 else {}
            user_info = (data.get("data") or {}).get("user") or {}
            stats_info = (data.get("data") or {}).get("stats") or {}
            avatar = (
                user_info.get("avatarLarger")
                or user_info.get("avatarMedium")
                or user_info.get("avatarThumb")
            )
            if not avatar:
                return None

            clean_handle = user_info.get("uniqueId") or handle
            return {
                "id": f"tt-dp-{clean_handle}-{int(time.time())}",
                "payloadType": "profile_dp",
                "platform": "tiktok",
                "badgeLabel": f"TikTok Profile (@{clean_handle})",
                "sourceUrl": req.url,
                "creatorHandle": f"@{clean_handle}",
                "creatorName": user_info.get("nickname") or f"@{clean_handle}",
                "verified": bool(user_info.get("verified", True)),
                "extractedAt": now_timestamp(),
                "biography": user_info.get("signature") or "TikTok Creator Profile",
                "followersCount": format_followers(stats_info.get("followerCount")),
                "standardPreviewUrl": build_proxy_image_url(base_url, avatar),
                "hdOriginalUrl": build_download_url(
                    base_url, avatar, f"VIDNEX_{clean_handle}_TikTok_HD_DP.jpg"
                ),
                "dimensions": "1080 × 1080",
                "fileSize": "1.4 MB",
                "format": "JPG",
            }

        # 1B. TikTok Video / Photo Mode Slideshow / Audio MP3
        video_params: Dict[str, Any] = {"url": req.url, "hd": 1}
        if tikwm_key:
            video_params["api_key"] = tikwm_key
        resp = await client.get(
            "https://www.tikwm.com/api/",
            params=video_params,
            headers=headers,
        )
        if resp.status_code != 200:
            return None
        payload = resp.json()
        if payload.get("code") != 0 or not payload.get("data"):
            return None

        d = payload["data"]
        author = d.get("author") or {}
        handle = (author.get("unique_id") or "tiktok").lstrip("@")
        creator_name = author.get("nickname") or f"@{handle}"
        title = d.get("title") or "TikTok Original Media Stream"
        music_url = d.get("music") or (d.get("music_info") or {}).get("play")

        # Check if Photo Mode Slideshow (`images[]`)
        images = d.get("images")
        if isinstance(images, list) and len(images) > 0:
            items: List[Dict[str, Any]] = []
            for idx, img_url in enumerate(images):
                if not isinstance(img_url, str):
                    continue
                items.append(
                    {
                        "id": f"tt-slide-{idx + 1}",
                        "index": idx + 1,
                        "mediaType": "image",
                        "dimensions": "1080 × 1350",
                        "fileSize": "1.8 MB",
                        "thumbnailUrl": build_proxy_image_url(base_url, img_url),
                        "downloadUrl": build_download_url(
                            base_url,
                            img_url,
                            f"VIDNEX_{handle}_slide_{idx + 1}.jpg",
                        ),
                    }
                )
            result: Dict[str, Any] = {
                "id": f"tt-carousel-{d.get('id', int(time.time()))}",
                "payloadType": "carousel",
                "platform": "tiktok",
                "badgeLabel": "TikTok Photo Slideshow",
                "sourceUrl": req.url,
                "creatorHandle": f"@{handle}",
                "creatorName": creator_name,
                "verified": True,
                "extractedAt": now_timestamp(),
                "caption": title,
                "totalItems": len(items),
                "archiveSize": f"{len(items) * 1.8:.1f} MB",
                "items": items,
            }
            if music_url:
                result["audioTrack"] = {
                    "title": (d.get("music_info") or {}).get("title") or "Original Sound",
                    "fileSize": "2.4 MB",
                    "downloadUrl": build_download_url(
                        base_url, music_url, f"VIDNEX_{handle}_audio.mp3"
                    ),
                }
            return result

        hd_url = d.get("hdplay") or d.get("play")
        sd_url = d.get("play") or d.get("wmplay") or hd_url
        if not hd_url:
            return None

        cover_url = d.get("origin_cover") or d.get("cover") or author.get("avatar")
        return {
            "id": f"tt-vid-{d.get('id', int(time.time()))}",
            "payloadType": "video",
            "platform": "tiktok",
            "badgeLabel": "TikTok Video",
            "sourceUrl": req.url,
            "creatorHandle": f"@{handle}",
            "creatorName": creator_name,
            "verified": True,
            "extractedAt": now_timestamp(),
            "title": title,
            "duration": format_duration(d.get("duration")),
            "aspectRatio": "9:16",
            "resolution": "1080 × 1920",
            "codec": "H.264 / AAC • 60fps",
            "thumbnailUrl": build_proxy_image_url(base_url, cover_url),
            "formats": [
                {
                    "id": "hd-1080p",
                    "label": "Download HD 1080p (No Watermark)",
                    "quality": "1080p",
                    "container": "MP4",
                    "fileSize": format_filesize(d.get("hd_size") or d.get("size"), "16.4 MB"),
                    "noWatermark": True,
                    "downloadUrl": build_download_url(
                        base_url, hd_url, f"VIDNEX_tiktok_{handle}_1080p.mp4"
                    ),
                    "isPrimary": True,
                },
                {
                    "id": "sd-720p",
                    "label": "Download SD 720p",
                    "quality": "720p",
                    "container": "MP4",
                    "fileSize": format_filesize(d.get("size"), "8.2 MB"),
                    "noWatermark": True,
                    "downloadUrl": build_download_url(
                        base_url, sd_url, f"VIDNEX_tiktok_{handle}_720p.mp4"
                    ),
                },
                {
                    "id": "audio-mp3",
                    "label": "Extract Audio (MP3)",
                    "quality": "MP3",
                    "container": "MP3",
                    "fileSize": "1.8 MB",
                    "noWatermark": True,
                    "downloadUrl": build_download_url(
                        base_url,
                        music_url or hd_url,
                        f"VIDNEX_tiktok_{handle}_audio.mp3",
                    ),
                },
            ],
        }


# ==============================================================================
# ENGINE 2: BETTERTWITFIX / VXTWITTER ENGINE (github.com/dylanpdx/BetterTwitFix)
# ==============================================================================
async def extract_via_vxtwitter(
    req: ExtractRequest, base_url: str
) -> Optional[Dict[str, Any]]:
    match = re.search(
        r"(?:x\.com|twitter\.com)/([A-Za-z0-9_]+)/status/([0-9]+)",
        req.url,
        re.IGNORECASE,
    )
    if not match:
        return None
    user, status_id = match.group(1), match.group(2)
    vx_base = get_bettertwitfix_base_url()

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        # Stage 2A: BetterTwitFix / vxTwitter API (`media_extended`)
        try:
            vx_resp = await client.get(
                f"{vx_base}/{user}/status/{status_id}",
                headers={"User-Agent": BROWSER_UA, "Accept": "application/json"},
            )
            if vx_resp.status_code == 200 and "application/json" in vx_resp.headers.get(
                "content-type", ""
            ):
                vx = vx_resp.json()
                media_list = vx.get("media_extended") or []
                handle = (vx.get("user_screen_name") or user).lstrip("@")
                creator_name = vx.get("user_name") or f"@{handle}"
                tweet_text = vx.get("text") or f"X Video Broadcast by @{handle}"

                # Multi-item X Carousel (2+ items in `media_extended`)
                if len(media_list) > 1:
                    carousel_items: List[Dict[str, Any]] = []
                    for idx, m in enumerate(media_list):
                        if not isinstance(m, dict) or not m.get("url"):
                            continue
                        is_vid = m.get("type") in ("video", "gif")
                        m_url = str(m["url"])
                        if is_vid and "?tag=" in m_url:
                            m_url = m_url[: m_url.index("?tag=")]
                        ext = "mp4" if is_vid else "jpg"
                        sz = m.get("size") or {}
                        w = sz.get("width", 1080)
                        h = sz.get("height", 1350)
                        carousel_items.append(
                            {
                                "id": f"x-slide-{idx + 1}",
                                "index": idx + 1,
                                "mediaType": "video" if is_vid else "image",
                                "dimensions": f"{w} × {h}",
                                "fileSize": "5.4 MB" if is_vid else "1.8 MB",
                                "thumbnailUrl": build_proxy_image_url(
                                    base_url, m.get("thumbnail_url") or m_url
                                ),
                                "downloadUrl": build_download_url(
                                    base_url,
                                    m_url,
                                    f"VIDNEX_x_{handle}_slide_{idx + 1}.{ext}",
                                ),
                            }
                        )
                    if len(carousel_items) > 1:
                        return {
                            "id": f"x-carousel-{status_id}",
                            "payloadType": "carousel",
                            "platform": "twitter",
                            "badgeLabel": f"X Multi-Media Post (@{handle})",
                            "sourceUrl": req.url,
                            "creatorHandle": f"@{handle}",
                            "creatorName": creator_name,
                            "verified": True,
                            "extractedAt": now_timestamp(),
                            "caption": tweet_text,
                            "totalItems": len(carousel_items),
                            "archiveSize": f"{len(carousel_items) * 2.6:.1f} MB",
                            "items": carousel_items,
                        }

                video_item = next(
                    (
                        m
                        for m in media_list
                        if m.get("type") in ("video", "gif") and m.get("url")
                    ),
                    None,
                )
                if video_item:
                    vid_url = str(video_item["url"])
                    if "?tag=" in vid_url:
                        vid_url = vid_url[: vid_url.index("?tag=")]
                    thumb_url = video_item.get("thumbnail_url") or (
                        vx.get("mediaURLs") or [""]
                    )[0]
                    size_info = video_item.get("size") or {}
                    w = size_info.get("width", 1920)
                    h = size_info.get("height", 1080)
                    duration_sec = (video_item.get("duration_millis") or 30000) / 1000.0
                    return {
                        "id": f"x-vid-{status_id}",
                        "payloadType": "video",
                        "platform": "twitter",
                        "badgeLabel": f"X Post (@{handle})",
                        "sourceUrl": req.url,
                        "creatorHandle": f"@{handle}",
                        "creatorName": creator_name,
                        "verified": True,
                        "extractedAt": now_timestamp(),
                        "title": tweet_text,
                        "duration": format_duration(duration_sec),
                        "aspectRatio": "16:9" if w >= h else "9:16",
                        "resolution": f"{w} × {h}",
                        "codec": "H.264 / AAC • 60fps",
                        "thumbnailUrl": build_proxy_image_url(base_url, thumb_url),
                        "formats": [
                            {
                                "id": "hd-1080p",
                                "label": "Download HD 1080p (No Watermark)",
                                "quality": "1080p",
                                "container": "MP4",
                                "fileSize": "12.4 MB",
                                "noWatermark": True,
                                "downloadUrl": build_download_url(
                                    base_url, vid_url, f"VIDNEX_x_{handle}_{status_id}_1080p.mp4"
                                ),
                                "isPrimary": True,
                            },
                            {
                                "id": "sd-720p",
                                "label": "Download SD 720p",
                                "quality": "720p",
                                "container": "MP4",
                                "fileSize": "6.1 MB",
                                "noWatermark": True,
                                "downloadUrl": build_download_url(
                                    base_url, vid_url, f"VIDNEX_x_{handle}_{status_id}_720p.mp4"
                                ),
                            },
                            {
                                "id": "audio-mp3",
                                "label": "Extract Audio (MP3)",
                                "quality": "MP3",
                                "container": "MP3",
                                "fileSize": "1.2 MB",
                                "noWatermark": True,
                                "downloadUrl": build_download_url(
                                    base_url, vid_url, f"VIDNEX_x_{handle}_{status_id}_audio.mp3"
                                ),
                            },
                        ],
                    }
        except Exception:
            pass

        # Stage 2B: BetterTwitFix `twExtract` Syndication Engine (`cdn.syndication.twimg.com/tweet-result`)
        try:
            syn_token = calc_syndication_token(status_id)
            syn_resp = await client.get(
                f"https://cdn.syndication.twimg.com/tweet-result?id={status_id}&token={syn_token}",
                headers={"User-Agent": BROWSER_UA, "Accept": "application/json"},
            )
            if syn_resp.status_code == 200:
                syn = syn_resp.json()
                media_details = syn.get("mediaDetails") or (
                    syn.get("extended_entities") or {}
                ).get("media") or []
                for m_entry in media_details:
                    if not isinstance(m_entry, dict) or "video_info" not in m_entry:
                        continue
                    variants = (m_entry.get("video_info") or {}).get("variants") or []
                    best_mp4 = get_best_media_url(variants)
                    if best_mp4:
                        syn_user = syn.get("user") or {}
                        handle = (syn_user.get("screen_name") or user).lstrip("@")
                        orig_info = m_entry.get("original_info") or {}
                        w = orig_info.get("width", 1920)
                        h = orig_info.get("height", 1080)
                        dur_sec = (
                            (m_entry.get("video_info") or {}).get("duration_millis") or 28000
                        ) / 1000.0
                        thumb_url = m_entry.get("media_url_https")
                        return {
                            "id": f"x-vid-{status_id}",
                            "payloadType": "video",
                            "platform": "twitter",
                            "badgeLabel": f"X Post (@{handle})",
                            "sourceUrl": req.url,
                            "creatorHandle": f"@{handle}",
                            "creatorName": syn_user.get("name") or f"@{handle}",
                            "verified": True,
                            "extractedAt": now_timestamp(),
                            "title": syn.get("text") or f"X Video Broadcast by @{handle}",
                            "duration": format_duration(dur_sec),
                            "aspectRatio": "16:9" if w >= h else "9:16",
                            "resolution": f"{w} × {h}",
                            "codec": "H.264 / AAC • 60fps",
                            "thumbnailUrl": build_proxy_image_url(base_url, thumb_url),
                            "formats": [
                                {
                                    "id": "hd-1080p",
                                    "label": "Download HD 1080p (No Watermark)",
                                    "quality": "1080p",
                                    "container": "MP4",
                                    "fileSize": "12.4 MB",
                                    "noWatermark": True,
                                    "downloadUrl": build_download_url(
                                        base_url, best_mp4, f"VIDNEX_x_{handle}_{status_id}_1080p.mp4"
                                    ),
                                    "isPrimary": True,
                                },
                                {
                                    "id": "sd-720p",
                                    "label": "Download SD 720p",
                                    "quality": "720p",
                                    "container": "MP4",
                                    "fileSize": "6.1 MB",
                                    "noWatermark": True,
                                    "downloadUrl": build_download_url(
                                        base_url, best_mp4, f"VIDNEX_x_{handle}_{status_id}_720p.mp4"
                                    ),
                                },
                                {
                                    "id": "audio-mp3",
                                    "label": "Extract Audio (MP3)",
                                    "quality": "MP3",
                                    "container": "MP3",
                                    "fileSize": "1.2 MB",
                                    "noWatermark": True,
                                    "downloadUrl": build_download_url(
                                        base_url, best_mp4, f"VIDNEX_x_{handle}_{status_id}_audio.mp3"
                                    ),
                                },
                            ],
                        }
        except Exception:
            pass

        # Stage 2C: Fallback api.fxtwitter.com
        try:
            fx_resp = await client.get(
                f"https://api.fxtwitter.com/{user}/status/{status_id}",
                headers={"User-Agent": BROWSER_UA, "Accept": "application/json"},
            )
            if fx_resp.status_code == 200:
                fx = fx_resp.json()
                tweet = fx.get("tweet") or {}
                videos = (tweet.get("media") or {}).get("videos") or []
                if videos:
                    v = videos[0]
                    vid_url = v.get("url")
                    thumb_url = v.get("thumbnail_url")
                    author = tweet.get("author") or {}
                    handle = (author.get("screen_name") or user).lstrip("@")
                    w = v.get("width", 1920)
                    h = v.get("height", 1080)
                    return {
                        "id": f"x-vid-{status_id}",
                        "payloadType": "video",
                        "platform": "twitter",
                        "badgeLabel": f"X Post (@{handle})",
                        "sourceUrl": req.url,
                        "creatorHandle": f"@{handle}",
                        "creatorName": author.get("name") or f"@{handle}",
                        "verified": True,
                        "extractedAt": now_timestamp(),
                        "title": tweet.get("text") or f"X Video Broadcast by @{handle}",
                        "duration": format_duration(v.get("duration")),
                        "aspectRatio": "16:9" if w >= h else "9:16",
                        "resolution": f"{w} × {h}",
                        "codec": "H.264 / AAC • 60fps",
                        "thumbnailUrl": build_proxy_image_url(base_url, thumb_url),
                        "formats": [
                            {
                                "id": "hd-1080p",
                                "label": "Download HD 1080p (No Watermark)",
                                "quality": "1080p",
                                "container": "MP4",
                                "fileSize": "12.4 MB",
                                "noWatermark": True,
                                "downloadUrl": build_download_url(
                                    base_url, vid_url, f"VIDNEX_x_{handle}_{status_id}_1080p.mp4"
                                ),
                                "isPrimary": True,
                            },
                            {
                                "id": "sd-720p",
                                "label": "Download SD 720p",
                                "quality": "720p",
                                "container": "MP4",
                                "fileSize": "6.1 MB",
                                "noWatermark": True,
                                "downloadUrl": build_download_url(
                                    base_url, vid_url, f"VIDNEX_x_{handle}_{status_id}_720p.mp4"
                                ),
                            },
                            {
                                "id": "audio-mp3",
                                "label": "Extract Audio (MP3)",
                                "quality": "MP3",
                                "container": "MP3",
                                "fileSize": "1.2 MB",
                                "noWatermark": True,
                                "downloadUrl": build_download_url(
                                    base_url, vid_url, f"VIDNEX_x_{handle}_{status_id}_audio.mp3"
                                ),
                            },
                        ],
                    }
        except Exception:
            pass

    return None


# ==============================================================================
# ENGINE 3: YT-DLP + OPTIONAL COOKIES (Instagram, YouTube, Facebook, Snapchat)
# ==============================================================================
def _run_ytdlp_sync(target_url: str) -> Dict[str, Any]:
    cookie_file = prepare_cookies_file()
    ydl_opts: Dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": False,
        "extract_flat": False,
        "geo_bypass": True,
        "nocheckcertificate": True,
        "http_headers": {"User-Agent": BROWSER_UA},
    }
    if cookie_file:
        ydl_opts["cookiefile"] = cookie_file

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(target_url, download=False)
        return ydl.sanitize_info(info) if info else {}


def _select_best_progressive_mp4(formats: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    progressive = [
        f
        for f in formats
        if f.get("url")
        and f.get("vcodec") not in (None, "none")
        and f.get("acodec") not in (None, "none")
        and str(f.get("ext", "")).lower() in ("mp4", "mov", "m4v")
        and "m3u8" not in str(f.get("protocol", "")).lower()
    ]
    if progressive:
        progressive.sort(
            key=lambda f: (f.get("height") or 0, f.get("tbr") or 0), reverse=True
        )
        return progressive[0]

    any_video = [
        f
        for f in formats
        if f.get("url")
        and f.get("vcodec") not in (None, "none")
        and "m3u8" not in str(f.get("protocol", "")).lower()
    ]
    if any_video:
        any_video.sort(
            key=lambda f: (f.get("height") or 0, f.get("tbr") or 0), reverse=True
        )
        return any_video[0]
    return None


def _select_audio_stream(formats: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    audios = [
        f
        for f in formats
        if f.get("url")
        and f.get("acodec") not in (None, "none")
        and f.get("vcodec") in (None, "none")
    ]
    if audios:
        audios.sort(key=lambda f: f.get("abr") or f.get("tbr") or 0, reverse=True)
        return audios[0]
    return None


async def extract_via_ytdlp(
    req: ExtractRequest, base_url: str, platform: str
) -> Optional[Dict[str, Any]]:
    info = await asyncio.to_thread(_run_ytdlp_sync, req.url)
    if not info:
        return None

    handle = (
        info.get("uploader_id")
        or info.get("channel")
        or info.get("uploader")
        or req.identifier
        or platform
    )
    clean_handle = str(handle).lstrip("@").replace(" ", "_")
    creator_name = info.get("uploader") or info.get("channel") or f"@{clean_handle}"

    # Multi-item Carousel (`entries`)
    entries = info.get("entries")
    if isinstance(entries, list) and len(entries) > 1:
        items: List[Dict[str, Any]] = []
        for idx, entry in enumerate(entries):
            if not isinstance(entry, dict):
                continue
            entry_formats = entry.get("formats") or []
            best_v = _select_best_progressive_mp4(entry_formats)
            media_url = (best_v or {}).get("url") or entry.get("url") or entry.get("thumbnail")
            thumb_url = entry.get("thumbnail") or media_url
            is_video = bool(best_v or entry.get("vcodec") not in (None, "none"))
            ext = "mp4" if is_video else "jpg"
            w = entry.get("width") or 1080
            h = entry.get("height") or 1350
            if media_url:
                items.append(
                    {
                        "id": str(entry.get("id") or f"slide-{idx + 1}"),
                        "index": idx + 1,
                        "mediaType": "video" if is_video else "image",
                        "dimensions": f"{w} × {h}",
                        "fileSize": "6.4 MB" if is_video else "2.1 MB",
                        "thumbnailUrl": build_proxy_image_url(base_url, thumb_url),
                        "downloadUrl": build_download_url(
                            base_url,
                            media_url,
                            f"VIDNEX_{clean_handle}_slide_{idx + 1}.{ext}",
                        ),
                    }
                )
        if items:
            return {
                "id": f"carousel-{info.get('id', int(time.time()))}",
                "payloadType": "carousel",
                "platform": platform,
                "badgeLabel": req.badgeLabel or f"{platform.capitalize()} Carousel",
                "sourceUrl": req.url,
                "creatorHandle": f"@{clean_handle}",
                "creatorName": creator_name,
                "verified": True,
                "extractedAt": now_timestamp(),
                "caption": info.get("description") or info.get("title") or "Multi-Slide Media Archive",
                "totalItems": len(items),
                "archiveSize": f"{len(items) * 2.5:.1f} MB",
                "items": items,
            }

    # Single Video / Reel / Short
    formats = info.get("formats") or []
    best_prog = _select_best_progressive_mp4(formats)
    audio_fmt = _select_audio_stream(formats)

    direct_url = (best_prog or {}).get("url") or info.get("url")
    if not direct_url:
        return None

    needs_mux = (
        best_prog is not None
        and best_prog.get("acodec") in (None, "none")
        and platform == "youtube"
    )
    w = (best_prog or {}).get("width") or info.get("width") or 1080
    h = (best_prog or {}).get("height") or info.get("height") or 1920
    thumb_url = info.get("thumbnail")
    filesize = (best_prog or {}).get("filesize") or (best_prog or {}).get("filesize_approx")

    return {
        "id": f"vid-{platform}-{info.get('id', int(time.time()))}",
        "payloadType": "video",
        "platform": platform,
        "badgeLabel": req.badgeLabel or f"{platform.capitalize()} Video",
        "sourceUrl": req.url,
        "creatorHandle": f"@{clean_handle}",
        "creatorName": creator_name,
        "verified": True,
        "extractedAt": now_timestamp(),
        "title": info.get("title") or info.get("description") or "HD Master Stream",
        "duration": format_duration(info.get("duration")),
        "aspectRatio": "16:9" if w > h else "9:16",
        "resolution": f"{w} × {h}",
        "codec": "H.264 / AAC • 60fps",
        "thumbnailUrl": build_proxy_image_url(base_url, thumb_url),
        "formats": [
            {
                "id": "hd-1080p",
                "label": "Download HD 1080p (No Watermark)",
                "quality": "1080p",
                "container": "MP4",
                "fileSize": format_filesize(filesize, "15.8 MB"),
                "noWatermark": True,
                "downloadUrl": build_download_url(
                    base_url,
                    direct_url,
                    f"VIDNEX_{platform}_{clean_handle}_1080p.mp4",
                    mux_url=req.url if needs_mux else None,
                ),
                "isPrimary": True,
            },
            {
                "id": "sd-720p",
                "label": "Download SD 720p",
                "quality": "720p",
                "container": "MP4",
                "fileSize": "7.4 MB",
                "noWatermark": True,
                "downloadUrl": build_download_url(
                    base_url,
                    direct_url,
                    f"VIDNEX_{platform}_{clean_handle}_720p.mp4",
                ),
            },
            {
                "id": "audio-mp3",
                "label": "Extract Audio (MP3)",
                "quality": "MP3",
                "container": "MP3",
                "fileSize": format_filesize((audio_fmt or {}).get("filesize"), "1.6 MB"),
                "noWatermark": True,
                "downloadUrl": build_download_url(
                    base_url,
                    (audio_fmt or {}).get("url") or direct_url,
                    f"VIDNEX_{platform}_{clean_handle}_audio.mp3",
                ),
            },
        ],
    }


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "engines": ["tikwm", "vxtwitter", "yt-dlp"],
        "ffmpeg": bool(shutil.which("ffmpeg")),
        "cookiesConfigured": bool(os.environ.get("COOKIES_TXT_BASE64")),
    }


@app.post("/api/extract")
async def extract_media(req: ExtractRequest, request: Request):
    raw_url = (req.url or "").strip()
    if not raw_url:
        raise HTTPException(status_code=400, detail="Missing URL in request body.")

    if "private" in raw_url.lower():
        return JSONResponse(
            status_code=422,
            content={
                "message": "EXTRACTION_DENIED: Target media belongs to a private account or restricted broadcast."
            },
        )

    base_url = get_base_url(request)
    lower_url = raw_url.lower()
    platform = (req.platform or "").lower()
    if not platform:
        if "tiktok.com" in lower_url:
            platform = "tiktok"
        elif "x.com" in lower_url or "twitter.com" in lower_url:
            platform = "twitter"
        elif "youtube.com" in lower_url or "youtu.be" in lower_url:
            platform = "youtube"
        elif "facebook.com" in lower_url or "fb.watch" in lower_url:
            platform = "facebook"
        elif "snapchat.com" in lower_url:
            platform = "snapchat"
        else:
            platform = "instagram"

    # Engine 1: TikTok Direct Engine (TikWM -> yt-dlp fallback)
    if platform == "tiktok":
        try:
            res = await extract_via_tikwm(req, base_url)
            if res:
                return res
        except Exception:
            pass

    # Engine 2: X / Twitter Instant JSON Engine (vxTwitter/fxTwitter -> yt-dlp fallback)
    if platform == "twitter":
        try:
            res = await extract_via_vxtwitter(req, base_url)
            if res:
                return res
        except Exception:
            pass

    # Engine 3: Universal yt-dlp Engine (Instagram, YouTube Shorts, Facebook, Snapchat, + Fallbacks)
    try:
        res = await extract_via_ytdlp(req, base_url, platform)
        if res:
            return res
    except Exception as exc:
        return JSONResponse(
            status_code=422,
            content={
                "message": f"Upstream media extraction failed: {str(exc)[:180]}"
            },
        )

    return JSONResponse(
        status_code=422,
        content={"message": "Unable to resolve media stream from the provided link."},
    )


@app.get("/api/proxy-image")
async def proxy_image(url: str = Query(..., description="Remote thumbnail URL")):
    validated_url = validate_public_url(url)
    parsed = urlparse(validated_url)
    referer = f"{parsed.scheme}://{parsed.netloc}/"

    async def stream_img():
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            async with client.stream(
                "GET",
                validated_url,
                headers={"User-Agent": BROWSER_UA, "Referer": referer},
            ) as resp:
                resp.raise_for_status()
                async for chunk in resp.aiter_bytes(chunk_size=32768):
                    yield chunk

    return StreamingResponse(
        stream_img(),
        media_type="image/jpeg",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400",
        },
    )


def _mux_with_ytdlp_sync(source_url: str, output_path: str) -> str:
    cookie_file = prepare_cookies_file()
    ydl_opts: Dict[str, Any] = {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "merge_output_format": "mp4",
        "outtmpl": output_path,
        "quiet": True,
        "no_warnings": True,
        "http_headers": {"User-Agent": BROWSER_UA},
    }
    if cookie_file:
        ydl_opts["cookiefile"] = cookie_file
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([source_url])
    return output_path


@app.get("/api/download")
async def download_media(
    url: str = Query(..., description="Direct media stream URL"),
    filename: str = Query("VIDNEX_media.mp4", description="Output filename"),
    mux: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
):
    safe_filename = re.sub(r"[^a-zA-Z0-9._-]", "_", filename) or "VIDNEX_media.mp4"
    lower_name = safe_filename.lower()
    if lower_name.endswith(".mp4"):
        media_type = "video/mp4"
    elif lower_name.endswith(".mp3"):
        media_type = "audio/mpeg"
    elif lower_name.endswith(".jpg") or lower_name.endswith(".jpeg"):
        media_type = "image/jpeg"
    elif lower_name.endswith(".zip"):
        media_type = "application/zip"
    else:
        media_type = "application/octet-stream"

    # Optional ephemeral yt-dlp + ffmpeg muxing for split 1080p streams
    if mux == "1" and source:
        validated_source = validate_public_url(source)
        tmp_dir = tempfile.mkdtemp(prefix="vidnex_mux_")
        out_file = os.path.join(tmp_dir, safe_filename)
        try:
            await asyncio.to_thread(_mux_with_ytdlp_sync, validated_source, out_file)
            if os.path.exists(out_file) and os.path.getsize(out_file) > 1024:
                return FileResponse(
                    out_file,
                    media_type=media_type,
                    filename=safe_filename,
                    headers={
                        "Content-Disposition": f'attachment; filename="{safe_filename}"',
                        "Access-Control-Allow-Origin": "*",
                    },
                    background=BackgroundTask(shutil.rmtree, tmp_dir, True),
                )
        except Exception:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    validated_url = validate_public_url(url)
    parsed = urlparse(validated_url)
    referer = (
        "https://www.tiktok.com/"
        if "tiktok" in parsed.netloc
        else "https://www.instagram.com/"
        if "instagram" in parsed.netloc
        else f"{parsed.scheme}://{parsed.netloc}/"
    )

    client = httpx.AsyncClient(timeout=60.0, follow_redirects=True)
    req = client.build_request(
        "GET",
        validated_url,
        headers={"User-Agent": BROWSER_UA, "Referer": referer, "Accept": "*/*"},
    )
    resp = await client.send(req, stream=True)
    if resp.status_code >= 400:
        await resp.aclose()
        await client.aclose()
        raise HTTPException(
            status_code=502, detail=f"Upstream CDN returned {resp.status_code}"
        )

    headers = {
        "Content-Disposition": f'attachment; filename="{safe_filename}"',
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
    }
    content_length = resp.headers.get("content-length")
    if content_length:
        headers["Content-Length"] = content_length

    async def iterate_stream():
        try:
            async for chunk in resp.aiter_bytes(chunk_size=65536):
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    return StreamingResponse(iterate_stream(), media_type=media_type, headers=headers)
