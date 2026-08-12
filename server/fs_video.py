"""
fs_video.py — Phase 2b Smart Video Streaming (Server-Side Cache)
=================================================================
Handles FFmpeg-based remux + caching for video containers that browsers
can't play directly (MKV, AVI, WMV, etc.) and subtitle extraction.

Phase 2b replaces the streaming-pipe approach with a server-side cache:
  FFmpeg → _cache/<hash>.mp4  → range-served like any static file

This gives the browser a real file with a known Content-Length, which means:
  - Full HTTP Range support → seekable playback, rewind, fast-forward
  - Plyr controls work (scrubber, duration, chapter markers)
  - No zombie FFmpeg processes on client disconnect
  - Cached files are served instantly on repeat access

Mounted at prefix /api/fs alongside fs_api so all routes stay at /api/fs/*.
Separated from fs_api.py to isolate video logic from filesystem CRUD.
"""

import hashlib
import json
import mimetypes
import os
import subprocess
import threading
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse

router = APIRouter(prefix="/api/fs", tags=["video"])

SOVEREIGN_ROOT = os.getenv("SOVEREIGN_ROOT", str(Path.home()))

# ── Codec sets ────────────────────────────────────────────────────────────────
# Codecs Chrome can decode from a served file.
# HEVC excluded: Chrome on Linux silently drops the video track when served via
# a streaming pipe and plays audio-only.  Native .mp4 HEVC works via range
# streaming on a real file, but our remux target is always H.264 or VP9.
# mpeg1video, mpeg2video, mpeg4 (XviD/DivX), wmv2/3 → Phase 3 transcode only.
BROWSER_SAFE_VIDEO_CODECS = {'h264', 'vp8', 'vp9', 'av1', 'theora'}

MP4_VIDEO_CODECS  = {'h264', 'avc1'}
WEBM_VIDEO_CODECS = {'vp8', 'vp9', 'av1', 'theora'}

# Audio codecs that can be stream-copied without re-encoding.
MP4_COPY_AUDIO  = {'aac', 'mp3', 'alac'}
WEBM_COPY_AUDIO = {'opus', 'vorbis'}

# Extensions that require the FFmpeg cache path instead of direct range serving.
FFMPEG_CONTAINERS = {'mkv', 'avi', 'mpg', 'mpeg', 'wmv', 'm4v', 'flv', '3gp', 'ts', 'vob'}

# Phase 3 gate — software transcode for HEVC, DivX, WMV3, etc.
ENABLE_ADVANCED_TRANSCODE = os.getenv(
    "ENABLE_ADVANCED_TRANSCODE", "false"
).lower() in ("true", "1", "yes")

# ── Cache config ──────────────────────────────────────────────────────────────
VIDEO_CACHE_MAX_AGE_H = int(os.getenv("VIDEO_CACHE_MAX_AGE_H", "24"))
VIDEO_CACHE_MAX_GB    = float(os.getenv("VIDEO_CACHE_MAX_GB", "10"))

# In-process lock table: prevents two simultaneous requests for the same file
# from both running FFmpeg.  Keyed by cache key string.
_cache_locks: dict[str, threading.Lock] = {}
_cache_locks_mutex = threading.Lock()


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_safe_path(target_path: str) -> Path:
    return Path(target_path).expanduser().resolve()


def get_cache_dir() -> Path:
    """Return (and create if needed) the cache directory."""
    raw = os.getenv("VIDEO_CACHE_DIR", "").strip()
    d = Path(raw) if raw else Path(__file__).parent / "_cache"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_cache_key(p: Path) -> str:
    """
    Deterministic cache key: SHA-256 of (absolute path + mtime + size).
    If the source file is modified, the key changes and the stale cache entry
    is simply ignored (lazy eviction will clean it up later).
    """
    stat    = p.stat()
    payload = f"{p.resolve()}|{stat.st_mtime}|{stat.st_size}"
    return hashlib.sha256(payload.encode()).hexdigest()


def _get_file_lock(key: str) -> threading.Lock:
    """Return the per-key threading.Lock, creating it if necessary."""
    with _cache_locks_mutex:
        if key not in _cache_locks:
            _cache_locks[key] = threading.Lock()
        return _cache_locks[key]


def _sweep_cache(cache_dir: Path) -> None:
    """
    Lazy eviction — called before each new cache write.

    Pass 1: Delete .mp4 / .webm files older than VIDEO_CACHE_MAX_AGE_H hours.
    Pass 2: If total remaining size still exceeds VIDEO_CACHE_MAX_GB, evict
            LRU entries (oldest mtime first) until under the cap.

    Ignores .tmp and .lock files so in-progress writes aren't disrupted.
    """
    max_age_secs = VIDEO_CACHE_MAX_AGE_H * 3600
    max_bytes    = int(VIDEO_CACHE_MAX_GB * 1024 ** 3)
    now          = time.time()

    survivors: list[tuple[float, int, Path]] = []   # (mtime, size, path)

    for f in cache_dir.iterdir():
        if f.suffix not in ('.mp4', '.webm') or not f.is_file():
            continue
        try:
            stat = f.stat()
            if now - stat.st_mtime > max_age_secs:
                f.unlink(missing_ok=True)
            else:
                survivors.append((stat.st_mtime, stat.st_size, f))
        except OSError:
            pass

    # LRU size cap — sort oldest first and evict until under limit
    total = sum(sz for _, sz, _ in survivors)
    if total > max_bytes:
        survivors.sort()
        for _, sz, f in survivors:
            if total <= max_bytes:
                break
            try:
                f.unlink(missing_ok=True)
                total -= sz
            except OSError:
                pass


# ── ffprobe ───────────────────────────────────────────────────────────────────

def _probe_codecs(p: Path) -> dict:
    """
    Run ffprobe on a file and return codec info for video, audio, and subtitles.

    Returns:
        {
          'video':     str | None,
          'audio':     str | None,
          'subtitles': [{ index, lang, label, codec }, ...],
        }
    """
    result: dict = {'video': None, 'audio': None, 'subtitles': []}

    try:
        proc = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_streams', str(p)],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if proc.returncode != 0:
            return result

        data           = json.loads(proc.stdout)
        subtitle_index = 0

        for stream in data.get('streams', []):
            ctype = stream.get('codec_type', '')
            cname = stream.get('codec_name', '')

            if ctype == 'video' and result['video'] is None:
                result['video'] = cname
            elif ctype == 'audio' and result['audio'] is None:
                result['audio'] = cname
            elif ctype == 'subtitle':
                tags  = stream.get('tags', {})
                result['subtitles'].append({
                    'index': subtitle_index,
                    'lang':  tags.get('language', 'und'),
                    'label': tags.get('title', f'Track {subtitle_index + 1}'),
                    'codec': cname,
                })
                subtitle_index += 1

    except Exception:
        pass

    return result


# ── Cache build ───────────────────────────────────────────────────────────────

def _needs_ffmpeg(p: Path) -> bool:
    """Return True if this file's extension requires the FFmpeg cache path."""
    return p.suffix.lstrip('.').lower() in FFMPEG_CONTAINERS


def _get_cache_format(video_codec: str, audio_codec: str | None) -> tuple[str, str, list[str], list[str]]:
    """
    Given video + audio codec names, return (ext, mime, audio_args, fmt_args)
    for the FFmpeg remux command.

    Raises ValueError for unsupported video codecs (caller handles this).
    """
    if video_codec in MP4_VIDEO_CODECS:
        audio_args = (
            ['-c:a', 'copy']
            if (audio_codec is None or audio_codec in MP4_COPY_AUDIO)
            else ['-c:a', 'aac', '-b:a', '192k']
        )
        # Normal MP4 muxer — cache file is complete, no need for frag_keyframe
        return '.mp4', 'video/mp4', audio_args, ['-f', 'mp4']

    elif video_codec in WEBM_VIDEO_CODECS:
        audio_args = (
            ['-c:a', 'copy']
            if (audio_codec is None or audio_codec in WEBM_COPY_AUDIO)
            else ['-c:a', 'libopus', '-b:a', '192k']
        )
        return '.webm', 'video/webm', audio_args, ['-f', 'webm']

    else:
        raise ValueError(f"unsupported: {video_codec}")


def get_or_build_cache(p: Path) -> tuple[Path, str]:
    """
    Return (cache_file_path, mime_type) for the given source file.

    Cache hit:  returns instantly (no ffprobe, no FFmpeg).
    Cache miss: probes codecs, runs FFmpeg remux to a .tmp file, renames
                atomically on success.  The threading.Lock prevents two
                simultaneous requests from both running FFmpeg for the same key.

    Raises HTTPException on all error conditions so FastAPI can return a
    proper JSON error response to the frontend.
    """
    cache_dir = get_cache_dir()
    key       = get_cache_key(p)

    # ── Fast path: check both possible cache extensions ──────────────────────
    for ext, mime in (('.mp4', 'video/mp4'), ('.webm', 'video/webm')):
        candidate = cache_dir / f"{key}{ext}"
        if candidate.exists():
            return candidate, mime

    # ── Slow path: probe → build ─────────────────────────────────────────────
    # Check FFmpeg availability before the potentially long probe+remux.
    try:
        chk = subprocess.run(['ffmpeg', '-version'], capture_output=True, timeout=3)
        if chk.returncode != 0:
            raise FileNotFoundError
    except (FileNotFoundError, subprocess.TimeoutExpired):
        raise HTTPException(status_code=503, detail='FFmpeg is not available on this server.')

    probe       = _probe_codecs(p)
    video_codec = probe['video']
    audio_codec = probe['audio']

    if video_codec is None:
        raise HTTPException(
            status_code=422,
            detail='Could not read codec information from this file.',
        )

    if video_codec not in BROWSER_SAFE_VIDEO_CODECS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Video codec '{video_codec}' cannot be played in the browser. "
                "Set ENABLE_ADVANCED_TRANSCODE=true in .env to enable software "
                "transcoding, or download the file to play locally."
            ),
        )

    try:
        ext, mime, audio_args, fmt_args = _get_cache_format(video_codec, audio_codec)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Unsupported codec: {video_codec}")

    dest = cache_dir / f"{key}{ext}"
    tmp  = cache_dir / f"{key}.tmp"

    # ── Acquire per-key lock to prevent duplicate remux ──────────────────────
    lock = _get_file_lock(key)
    with lock:
        # Double-check inside the lock — another thread may have just finished
        if dest.exists():
            return dest, mime

        _sweep_cache(cache_dir)

        cmd = [
            'ffmpeg', '-i', str(p),
            '-c:v', 'copy',
            *audio_args,
            '-avoid_negative_ts', 'make_zero',
            *fmt_args,
            str(tmp),
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=600,      # 10 min: generous for large remux, still bounded
            )
        except subprocess.TimeoutExpired:
            tmp.unlink(missing_ok=True)
            raise HTTPException(status_code=504, detail='FFmpeg remux timed out (>10 min).')
        except Exception as exc:
            tmp.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail=f'FFmpeg error: {exc}')

        if result.returncode != 0 or not tmp.exists():
            tmp.unlink(missing_ok=True)
            raise HTTPException(
                status_code=422,
                detail='FFmpeg remux failed. The file may be corrupt or use an unsupported codec.',
            )

        tmp.rename(dest)   # Atomic on Linux — no partial file ever served

    return dest, mime


# ── Range-serving helper ──────────────────────────────────────────────────────

def _serve_with_range(file_path: Path, mime: str, request: Request) -> StreamingResponse:
    """
    Serve a local file with full HTTP Range support.
    Used for both native files and FFmpeg-cached files.
    """
    file_size    = file_path.stat().st_size
    range_header = request.headers.get('range')

    if range_header:
        try:
            byte_range         = range_header.replace('bytes=', '').strip()
            start_str, end_str = byte_range.split('-')
            start = int(start_str)
            end   = int(end_str) if end_str.strip() else file_size - 1
        except (ValueError, AttributeError):
            start = 0
            end   = file_size - 1

        end        = min(end, file_size - 1)
        chunk_size = end - start + 1

        def _iter(path: Path, s: int, length: int):
            with open(path, 'rb') as f:
                f.seek(s)
                remaining = length
                while remaining > 0:
                    data = f.read(min(65536, remaining))
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        return StreamingResponse(
            _iter(file_path, start, chunk_size),
            status_code=206,
            media_type=mime,
            headers={
                'Content-Range':  f'bytes {start}-{end}/{file_size}',
                'Content-Length': str(chunk_size),
                'Accept-Ranges':  'bytes',
            },
        )

    # No Range header — stream the full file in 64 KB chunks.
    # DO NOT pass open(file_path, 'rb') directly to StreamingResponse: uvicorn
    # may buffer the entire response body before sending, turning a large file
    # into an equivalent-sized memory allocation on the server.
    def _full_iter(path: Path):
        with open(path, 'rb') as f:
            while True:
                data = f.read(65536)
                if not data:
                    break
                yield data

    return StreamingResponse(
        _full_iter(file_path),
        media_type=mime,
        headers={
            'Content-Length': str(file_size),
            'Accept-Ranges':  'bytes',
        },
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/stream")
def stream_file(path: str, request: Request, native: bool = False):
    """
    Universal video stream endpoint.

    native=True (Phase 3a): Client has verified browser can decode this file
    natively via canPlayType() — serve the original file with range support,
    bypassing FFmpeg entirely. Used for HEVC and other codecs that the browser
    can hardware-decode directly.

    Native containers (mp4, webm, mov, …):
        Served directly with HTTP Range support.  Zero processing overhead.

    Non-native containers (mkv, avi, wmv, …):
        Remuxed into a browser-compatible format via FFmpeg and cached on
        disk.  First open blocks while FFmpeg runs (2–5 s for remux).
        Subsequent opens are instant from cache.

    Returns 422 JSON when the video codec requires full transcoding.
    """
    p = get_safe_path(path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail='File not found')

    if native:
        # Phase 3a: browser already verified codec support via canPlayType().
        # Serve the original file directly — no FFmpeg, no remux.
        mime, _ = mimetypes.guess_type(str(p))
        if not mime or mime == 'application/octet-stream':
            # mimetypes doesn't know most video container extensions — provide fallbacks.
            _ext_mime = {
                '.mkv':  'video/x-matroska',
                '.avi':  'video/x-msvideo',
                '.wmv':  'video/x-ms-wmv',
                '.m4v':  'video/mp4',
                '.flv':  'video/x-flv',
                '.3gp':  'video/3gpp',
                '.ts':   'video/mp2t',
                '.vob':  'video/mpeg',
                '.mpg':  'video/mpeg',
                '.mpeg': 'video/mpeg',
            }
            mime = _ext_mime.get(p.suffix.lower(), 'application/octet-stream')
        return _serve_with_range(p, mime, request)

    if _needs_ffmpeg(p):
        # May block during remux on first open — frontend shows 'caching' state
        cache_file, mime = get_or_build_cache(p)
        return _serve_with_range(cache_file, mime, request)

    # Native file — direct range serving, no FFmpeg
    mime, _ = mimetypes.guess_type(str(p))
    mime    = mime or 'application/octet-stream'
    return _serve_with_range(p, mime, request)


@router.get("/stream/status")
def stream_status(path: str):
    """
    Poll the server-side cache status for a given source path.
    Returns { state: 'cached'|'not_cached', key: str }
    """
    p = get_safe_path(path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail='File not found')

    cache_dir = get_cache_dir()
    key       = get_cache_key(p)

    for ext in ('.mp4', '.webm'):
        if (cache_dir / f"{key}{ext}").exists():
            return {'state': 'cached', 'key': key}

    return {'state': 'not_cached', 'key': key}


@router.get("/stream/probe")
def stream_probe(path: str):
    """
    Phase 3a: Return codec info for client-side native playback detection.

    Runs ffprobe on the file and returns the video and audio codec names.
    The client uses these to call canPlayType() and decide whether to request
    the file natively (native=1) or fall back to the FFmpeg remux path.

    No transcoding — this endpoint only reads metadata.
    Returns null codec fields gracefully when ffprobe is unavailable.
    """
    p = get_safe_path(path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail='File not found')

    size_bytes = p.stat().st_size

    try:
        chk = subprocess.run(['ffprobe', '-version'], capture_output=True, timeout=3)
        if chk.returncode != 0:
            return {'video_codec': None, 'audio_codec': None, 'size_bytes': size_bytes}
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return {'video_codec': None, 'audio_codec': None, 'size_bytes': size_bytes}

    probe = _probe_codecs(p)
    return {
        'video_codec': probe['video'],
        'audio_codec': probe['audio'],
        'size_bytes':  size_bytes,
    }


@router.get("/ffmpeg-health")
def ffmpeg_health():
    """
    Lazy FFmpeg availability check.

    Called by the frontend the first time a non-native video file is opened.
    The result is cached in a React ref for the entire browser session.
    """
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            first_line = result.stdout.split('\n')[0]
            parts      = first_line.split(' ')
            version    = parts[2] if len(parts) > 2 else 'unknown'
            return {'available': True, 'version': version}
        return {'available': False, 'version': None}
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        return {'available': False, 'version': None}


@router.get("/subtitles/list")
def list_subtitle_tracks(path: str):
    """
    List embedded subtitle tracks in a video file.
    Returns { tracks: [{ index, lang, label, codec }] } or empty list.
    """
    p = get_safe_path(path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail='File not found')

    try:
        chk = subprocess.run(['ffprobe', '-version'], capture_output=True, timeout=3)
        if chk.returncode != 0:
            return {'tracks': []}
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return {'tracks': []}

    probe = _probe_codecs(p)
    return {'tracks': probe['subtitles']}


@router.get("/subtitles")
def get_subtitle_track(path: str, track: int = 0):
    """
    Extract one subtitle track from a video file and return it as WebVTT.
    track: 0-indexed subtitle stream position.

    Uses subprocess.run (fully buffered) — subtitle files are small text and
    a streaming pipe was causing uvicorn graceful-reload to block when the
    client disconnected mid-stream.
    """
    p = get_safe_path(path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail='File not found')

    try:
        chk = subprocess.run(['ffmpeg', '-version'], capture_output=True, timeout=3)
        if chk.returncode != 0:
            raise FileNotFoundError
    except (FileNotFoundError, subprocess.TimeoutExpired):
        raise HTTPException(status_code=503, detail='FFmpeg not available')

    try:
        result = subprocess.run(
            ['ffmpeg', '-i', str(p), '-map', f'0:s:{track}', '-f', 'webvtt', 'pipe:1'],
            capture_output=True,
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail='Subtitle extraction timed out')
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Subtitle extraction failed: {exc}')

    if result.returncode != 0 or not result.stdout:
        raise HTTPException(status_code=422, detail='No subtitle data for this track')

    return Response(
        content=result.stdout,
        media_type='text/vtt; charset=utf-8',
        headers={'Content-Disposition': f'inline; filename="subtitles_{track}.vtt"'},
    )
