"""
fs_video.py - video streaming with a server-side remux cache.

Handles FFmpeg-based remux and caching for video containers that browsers
can't play directly (MKV, AVI, WMV, etc.) and subtitle extraction:
  FFmpeg -> _cache/<hash>.mp4  -> range-served like any static file

A cached file has a known Content-Length, which means:
  - Full HTTP Range support: seekable playback, rewind, fast-forward
  - Plyr controls work (scrubber, duration, chapter markers)
  - Cached files are served instantly on repeat access

Mounted at prefix /api/fs alongside fs_api so all routes stay at /api/fs/*.
Kept apart from fs_api.py to isolate video logic from filesystem CRUD.
Every route checks that the logged-in user can read the file (see fs_api.require_readable).
"""

import hashlib
import json
import logging
import mimetypes
import os
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path

from auth import require_auth
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response, StreamingResponse
from fs_api import get_safe_path, require_readable

logger = logging.getLogger(__name__)

# Every route here reads a file by path, so each one requires a session.
router = APIRouter(prefix="/api/fs", tags=["video"], dependencies=[Depends(require_auth)])

# ── Codec sets ────────────────────────────────────────────────────────────────
# Codecs Chrome can decode from a served file.
# HEVC excluded: Chrome on Linux silently drops the video track when served via
# a streaming pipe and plays audio-only.  Native .mp4 HEVC works via range
# streaming on a real file, but our remux target is always H.264 or VP9.
# mpeg1video, mpeg2video, mpeg4 (XviD/DivX), wmv2/3 need a full transcode, which
# is not built.
BROWSER_SAFE_VIDEO_CODECS = {'h264', 'vp8', 'vp9', 'av1', 'theora'}

MP4_VIDEO_CODECS  = {'h264', 'avc1'}
WEBM_VIDEO_CODECS = {'vp8', 'vp9', 'av1', 'theora'}

# Audio codecs that can be stream-copied without re-encoding.
MP4_COPY_AUDIO  = {'aac', 'mp3', 'alac'}
WEBM_COPY_AUDIO = {'opus', 'vorbis'}

# Extensions that require the FFmpeg cache path instead of direct range serving.
FFMPEG_CONTAINERS = {'mkv', 'avi', 'mpg', 'mpeg', 'wmv', 'm4v', 'flv', '3gp', 'ts', 'vob'}

# Switch named for a software transcode of HEVC, DivX, WMV3, etc. Nothing reads it yet.
ENABLE_ADVANCED_TRANSCODE = os.getenv(
    "ENABLE_ADVANCED_TRANSCODE", "false"
).lower() in ("true", "1", "yes")


# ── Cache config ──────────────────────────────────────────────────────────────
VIDEO_CACHE_MAX_AGE_H = int(os.getenv("VIDEO_CACHE_MAX_AGE_H", "24"))
VIDEO_CACHE_MAX_GB    = float(os.getenv("VIDEO_CACHE_MAX_GB", "10"))

# Longest a single remux may run, and how many remuxes may run at once across all files.
REMUX_TIMEOUT_SECONDS = 600
MAX_PARALLEL_REMUXES  = max(1, int(os.getenv("VIDEO_MAX_PARALLEL_REMUXES", "2")))
_remux_slots = threading.BoundedSemaphore(MAX_PARALLEL_REMUXES)

TOOL_CHECK_TIMEOUT_SECONDS = 5
PROBE_TIMEOUT_SECONDS = 15
SUBTITLE_TIMEOUT_SECONDS = 30
CHUNK_BYTES = 65536

# In-process lock table: prevents two simultaneous requests for the same file
# from both running FFmpeg.  Keyed by cache key string.
_cache_locks: dict[str, threading.Lock] = {}
_cache_locks_mutex = threading.Lock()

# Container types mimetypes does not know.
_EXTRA_VIDEO_MIME = {
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


# ── Helpers ───────────────────────────────────────────────────────────────────

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
    is simply ignored (eviction cleans it up later).
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
    Eviction, called before each new cache write.

    Pass 1: Delete .mp4 / .webm files not used for VIDEO_CACHE_MAX_AGE_H hours,
            and .tmp files left behind by a build that was killed.
    Pass 2: If total remaining size still exceeds VIDEO_CACHE_MAX_GB, evict
            least recently used entries first until under the cap.

    A cache hit refreshes the file's mtime (see _cached_file), so mtime is
    the time of last use. Recent .tmp files are in-progress builds and are kept.
    """
    max_age_secs = VIDEO_CACHE_MAX_AGE_H * 3600
    max_bytes    = int(VIDEO_CACHE_MAX_GB * 1024 ** 3)
    stale_tmp    = REMUX_TIMEOUT_SECONDS * 2
    now          = time.time()

    survivors: list[tuple[float, int, Path]] = []   # (mtime, size, path)

    for f in cache_dir.iterdir():
        if f.suffix not in ('.mp4', '.webm', '.tmp') or not f.is_file():
            continue
        try:
            stat = f.stat()
            age = now - stat.st_mtime
            if f.suffix == '.tmp':
                if age > stale_tmp:
                    f.unlink(missing_ok=True)
            elif age > max_age_secs:
                f.unlink(missing_ok=True)
            else:
                survivors.append((stat.st_mtime, stat.st_size, f))
        except FileNotFoundError:
            continue   # a build finished or another sweep removed it meanwhile
        except OSError as exc:
            logger.warning("Video cache sweep could not process %s: %s", f.name, exc)

    # Size cap: sort oldest first and evict until under limit
    total = sum(sz for _, sz, _ in survivors)
    if total > max_bytes:
        survivors.sort()
        for _, sz, f in survivors:
            if total <= max_bytes:
                break
            try:
                f.unlink(missing_ok=True)
                total -= sz
            except OSError as exc:
                logger.warning("Video cache sweep could not evict %s: %s", f.name, exc)


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
    A failed probe (ffprobe missing, timed out, unreadable output) is logged and
    returns the empty result.
    """
    result: dict = {'video': None, 'audio': None, 'subtitles': []}

    try:
        proc = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_streams', str(p)],
            capture_output=True,
            text=True,
            timeout=PROBE_TIMEOUT_SECONDS,
            stdin=subprocess.DEVNULL,
            check=False,
        )
        if proc.returncode != 0:
            logger.warning("ffprobe exited %s for %s", proc.returncode, p.name)
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

    except (OSError, subprocess.TimeoutExpired, ValueError, AttributeError) as exc:
        logger.warning("ffprobe failed for %s: %s", p.name, exc)
        return {'video': None, 'audio': None, 'subtitles': []}

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
        # Normal MP4 muxer: the cache file is complete, no need for frag_keyframe
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


def _cached_file(cache_dir: Path, key: str) -> tuple[Path, str] | None:
    """Return (path, mime) of the cache entry for key, refreshing its mtime so eviction sees the use."""
    for ext, mime in (('.mp4', 'video/mp4'), ('.webm', 'video/webm')):
        candidate = cache_dir / f"{key}{ext}"
        if candidate.exists():
            try:
                os.utime(candidate)
            except OSError as exc:
                logger.warning("Could not refresh cache entry %s: %s", candidate.name, exc)
            return candidate, mime
    return None


def get_or_build_cache(p: Path) -> tuple[Path, str]:
    """
    Return (cache_file_path, mime_type) for the given source file.

    Cache hit:  returns instantly (no ffprobe, no FFmpeg).
    Cache miss: probes codecs, runs FFmpeg remux to a .tmp file, renames
                atomically on success.  A per-key lock stops two requests from
                both running FFmpeg for the same key (later ones wait, then hit
                the cache), and MAX_PARALLEL_REMUXES bounds remuxes across files.

    Raises HTTPException on all error conditions so FastAPI can return a
    proper JSON error response to the frontend.
    """
    cache_dir = get_cache_dir()
    key       = get_cache_key(p)

    hit = _cached_file(cache_dir, key)
    if hit:
        return hit

    if not shutil.which('ffmpeg'):
        raise HTTPException(status_code=503, detail='FFmpeg is not available on this server.')

    lock = _get_file_lock(key)
    with lock:
        # Another request may have just finished this build while we waited.
        hit = _cached_file(cache_dir, key)
        if hit:
            return hit

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
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Unsupported codec: {video_codec}") from exc

        dest = cache_dir / f"{key}{ext}"
        tmp  = cache_dir / f"{key}.{uuid.uuid4().hex}.tmp"

        cmd = [
            'ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(p),
            '-c:v', 'copy',
            *audio_args,
            '-avoid_negative_ts', 'make_zero',
            *fmt_args,
            str(tmp),
        ]

        with _remux_slots:
            _sweep_cache(cache_dir)
            try:
                # stdout is discarded; stderr (errors only, small) is kept for the log.
                result = subprocess.run(
                    cmd,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=REMUX_TIMEOUT_SECONDS,
                    stdin=subprocess.DEVNULL,
                    check=False,
                )
            except subprocess.TimeoutExpired as exc:
                tmp.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=504,
                    detail=f'FFmpeg remux timed out (>{REMUX_TIMEOUT_SECONDS // 60} min).',
                ) from exc
            except OSError as exc:
                tmp.unlink(missing_ok=True)
                raise HTTPException(status_code=500, detail=f'FFmpeg error: {exc}') from exc

        if result.returncode != 0 or not tmp.exists():
            tmp.unlink(missing_ok=True)
            reason = (result.stderr or '').strip().splitlines()
            logger.warning("FFmpeg remux of %s failed (exit %s): %s", p.name, result.returncode, reason[-1:])
            raise HTTPException(
                status_code=422,
                detail='FFmpeg remux failed. The file may be corrupt or use an unsupported codec.',
            )

        try:
            tmp.rename(dest)   # Atomic on Linux: no partial file is ever served
        except OSError as exc:
            tmp.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail=f'Could not store the remuxed file: {exc}') from exc

    # Evict the lock entry once the remux is done. Future requests hit the
    # cache check above and never reach _get_file_lock() for this key, which
    # keeps the dict from growing without bound over a long server uptime.
    with _cache_locks_mutex:
        _cache_locks.pop(key, None)

    return dest, mime


# ── Range-serving helper ──────────────────────────────────────────────────────

def _parse_range(header: str, file_size: int) -> tuple[int, int] | None:
    """
    Parse one HTTP byte range into inclusive (start, end) offsets.

    Returns None when there is no usable range (serve the whole file). Raises 416
    when the range lies outside the file. Only the first range of a list is used.
    """
    unsatisfiable = HTTPException(
        status_code=416,
        detail='Requested range not satisfiable',
        headers={'Content-Range': f'bytes */{file_size}'},
    )
    if not header.startswith('bytes='):
        return None
    start_str, sep, end_str = header[len('bytes='):].split(',')[0].strip().partition('-')
    if not sep:
        return None
    try:
        if start_str == '':
            # Suffix range: the last N bytes.
            suffix = int(end_str)
            if suffix <= 0 or file_size == 0:
                raise unsatisfiable
            return max(file_size - suffix, 0), file_size - 1
        start = int(start_str)
        end   = int(end_str) if end_str.strip() else file_size - 1
    except ValueError:
        return None
    if file_size == 0:
        raise unsatisfiable
    if start > end:
        return None
    if start >= file_size:
        raise unsatisfiable
    return start, min(end, file_size - 1)


def _serve_with_range(file_path: Path, mime: str, request: Request) -> StreamingResponse:
    """
    Serve a local file with full HTTP Range support.
    Used for both native files and FFmpeg-cached files.
    """
    try:
        file_size = file_path.stat().st_size
    except OSError as exc:
        raise HTTPException(status_code=404, detail='File not found') from exc

    byte_range = _parse_range(request.headers.get('range', ''), file_size)

    def _iter(path: Path, offset: int, length: int):
        with open(path, 'rb') as f:
            f.seek(offset)
            remaining = length
            while remaining > 0:
                data = f.read(min(CHUNK_BYTES, remaining))
                if not data:
                    break
                remaining -= len(data)
                yield data

    if byte_range:
        start, end = byte_range
        chunk_size = end - start + 1
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

    # No Range header: stream the full file in 64 KB chunks.
    # The file object is not passed to StreamingResponse directly: uvicorn
    # may buffer the entire response body before sending, turning a large file
    # into an equivalent-sized memory allocation on the server.
    return StreamingResponse(
        _iter(file_path, 0, file_size),
        media_type=mime,
        headers={
            'Content-Length': str(file_size),
            'Accept-Ranges':  'bytes',
        },
    )


# ── Routes ────────────────────────────────────────────────────────────────────

def _readable_file(path: str, request: Request) -> Path:
    """Resolve a request path to a regular file the logged-in user may read, or raise 404/403."""
    p = get_safe_path(path)
    if not p.is_file():
        raise HTTPException(status_code=404, detail='File not found')
    require_readable(request, p)
    return p


@router.get("/stream")
def stream_file(path: str, request: Request, native: bool = False):
    """
    Universal video stream endpoint.

    native=True: Client has verified browser can decode this file
    natively via canPlayType() - serve the original file with range support,
    bypassing FFmpeg entirely. Used for HEVC and other codecs that the browser
    can hardware-decode directly.

    Native containers (mp4, webm, mov, ...):
        Served directly with HTTP Range support.  Zero processing overhead.

    Non-native containers (mkv, avi, wmv, ...):
        Remuxed into a browser-compatible format via FFmpeg and cached on
        disk.  First open blocks while FFmpeg runs (2-5 s for remux).
        Subsequent opens are instant from cache.

    Returns 422 JSON when the video codec requires full transcoding.
    """
    p = _readable_file(path, request)

    if native:
        mime, _ = mimetypes.guess_type(str(p))
        if not mime or mime == 'application/octet-stream':
            # mimetypes doesn't know most video container extensions.
            mime = _EXTRA_VIDEO_MIME.get(p.suffix.lower(), 'application/octet-stream')
        return _serve_with_range(p, mime, request)

    if _needs_ffmpeg(p):
        # May block during remux on first open - frontend shows 'caching' state
        cache_file, mime = get_or_build_cache(p)
        return _serve_with_range(cache_file, mime, request)

    # Native file - direct range serving, no FFmpeg
    mime, _ = mimetypes.guess_type(str(p))
    mime    = mime or 'application/octet-stream'
    return _serve_with_range(p, mime, request)


@router.get("/stream/probe")
def stream_probe(path: str, request: Request):
    """
    Return codec info for client-side native playback detection.

    Runs ffprobe on the file and returns the video and audio codec names.
    The client uses these to call canPlayType() and decide whether to request
    the file natively (native=1) or fall back to the FFmpeg remux path.

    No transcoding - this endpoint only reads metadata.
    Returns null codec fields gracefully when ffprobe is unavailable.
    """
    p = _readable_file(path, request)

    size_bytes = p.stat().st_size

    if not shutil.which('ffprobe'):
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
    if not shutil.which('ffmpeg'):
        return {'available': False, 'version': None}
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'],
            capture_output=True,
            text=True,
            timeout=TOOL_CHECK_TIMEOUT_SECONDS,
            stdin=subprocess.DEVNULL,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        logger.warning("ffmpeg -version failed: %s", exc)
        return {'available': False, 'version': None}
    if result.returncode == 0:
        first_line = result.stdout.split('\n')[0]
        parts      = first_line.split(' ')
        version    = parts[2] if len(parts) > 2 else 'unknown'
        return {'available': True, 'version': version}
    return {'available': False, 'version': None}


@router.get("/subtitles/list")
def list_subtitle_tracks(path: str, request: Request):
    """
    List embedded subtitle tracks in a video file.
    Returns { tracks: [{ index, lang, label, codec }] } or empty list.
    """
    p = _readable_file(path, request)

    if not shutil.which('ffprobe'):
        return {'tracks': []}

    probe = _probe_codecs(p)
    return {'tracks': probe['subtitles']}


@router.get("/subtitles")
def get_subtitle_track(path: str, request: Request, track: int = Query(0, ge=0)):
    """
    Extract one subtitle track from a video file and return it as WebVTT.
    track: 0-indexed subtitle stream position.

    Uses subprocess.run (fully buffered): subtitle files are small text and
    a streaming pipe made uvicorn graceful-reload block when the client
    disconnected mid-stream.
    """
    p = _readable_file(path, request)

    if not shutil.which('ffmpeg'):
        raise HTTPException(status_code=503, detail='FFmpeg not available')

    try:
        result = subprocess.run(
            ['ffmpeg', '-nostdin', '-v', 'error', '-i', str(p), '-map', f'0:s:{track}', '-f', 'webvtt', 'pipe:1'],
            capture_output=True,
            timeout=SUBTITLE_TIMEOUT_SECONDS,
            stdin=subprocess.DEVNULL,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail='Subtitle extraction timed out') from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f'Subtitle extraction failed: {exc}') from exc

    if result.returncode != 0 or not result.stdout:
        raise HTTPException(status_code=422, detail='No subtitle data for this track')

    return Response(
        content=result.stdout,
        media_type='text/vtt; charset=utf-8',
        headers={'Content-Disposition': f'inline; filename="subtitles_{track}.vtt"'},
    )
