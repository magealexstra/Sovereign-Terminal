"""
fs_audio.py - Audio metadata and album art endpoints.

Provides two endpoints used by the AudioPlayer component:

  GET /api/fs/audio-art?path=...
      Returns album art as an image response.
      Source priority:
        1. Embedded art in the audio file (ID3 / FLAC / M4A picture block)
        2. Cover image file in the same directory (cover.jpg, folder.png, ...)
        3. 404 if neither found - client falls back to the Music icon

  GET /api/fs/audio-meta?path=...
      Returns ID3 / Vorbis / FLAC tag metadata and basic stream info.
      Never 404s on missing tags - returns empty strings for absent fields.
      When ffprobe is missing or fails, the title is the file name and the
      other fields are empty.

Both routes check that the logged-in user can read the file (see fs_api.require_readable).
"""

import json
import logging
import mimetypes
import os
import shutil
import subprocess
import threading
from pathlib import Path

from auth import require_auth
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, Response
from fs_api import get_safe_path, require_readable, user_can_read

logger = logging.getLogger(__name__)

# Every route here reads a file by path, so each one requires a session.
router = APIRouter(dependencies=[Depends(require_auth)])

# Cover image filenames to check when embedded art is absent, in preference order.
COVER_NAMES = [
    'cover', 'folder', 'album', 'front', 'artwork', 'thumb',
]
COVER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

MAX_ART_BYTES = 10 * 1024 * 1024   # embedded art above this size is not a cover image
ART_TIMEOUT_SECONDS = 15
PROBE_TIMEOUT_SECONDS = 10


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_embedded_art(p: Path) -> bytes | None:
    """
    Extract the first embedded image from an audio file via ffmpeg pipe.
    Returns raw image bytes, or None when the file has no embedded image,
    ffmpeg fails or times out, or the output is not a recognised image.

    The pipe read is capped at MAX_ART_BYTES rather than using capture_output=True,
    so ffmpeg cannot dump a large stream into memory, and a watchdog timer kills
    ffmpeg after ART_TIMEOUT_SECONDS so a stuck process cannot hold the request.
    """
    try:
        proc = subprocess.Popen(
            [
                'ffmpeg', '-nostdin', '-v', 'error', '-i', str(p),
                '-an',               # drop audio
                '-vcodec', 'copy',   # copy the image (video) stream as-is
                '-frames:v', '1',    # only one frame
                '-f', 'image2',      # force image muxer
                'pipe:1',            # write to stdout
            ],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
    except OSError as exc:
        logger.warning("ffmpeg could not start for album art of %s: %s", p.name, exc)
        return None

    watchdog = threading.Timer(ART_TIMEOUT_SECONDS, proc.kill)
    watchdog.start()
    try:
        data = proc.stdout.read(MAX_ART_BYTES + 1)
    finally:
        watchdog.cancel()
        proc.stdout.close()
        if proc.poll() is None:
            proc.kill()
        proc.wait()

    if proc.returncode != 0 or not data or len(data) > MAX_ART_BYTES:
        return None
    return data


def _detect_image_mime(data: bytes) -> str | None:
    """Detect image MIME type from magic bytes; None when the data is not a supported image."""
    if data[:4] == b'\x89PNG':
        return 'image/png'
    if data[:2] == b'\xff\xd8':
        return 'image/jpeg'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'image/webp'
    if data[:4] == b'GIF8':
        return 'image/gif'
    return None


def _find_directory_art(request: Request, p: Path) -> Path | None:
    """
    List the file's parent directory once and return the best cover image the
    logged-in user can read: names in COVER_NAMES order, extensions in
    COVER_EXTENSIONS order, matched case-insensitively. None if there is none.
    """
    found: dict[tuple[str, str], Path] = {}
    try:
        with os.scandir(p.parent) as entries:
            for entry in entries:
                stem, ext = os.path.splitext(entry.name)
                key = (stem.lower(), ext.lower())
                is_cover_name = key[0] in COVER_NAMES and key[1] in COVER_EXTENSIONS
                if is_cover_name and key not in found and entry.is_file():
                    found[key] = Path(entry.path)
    except OSError as exc:
        logger.warning("Could not list %s for cover art: %s", p.parent.name, exc)
        return None
    for name in COVER_NAMES:
        for ext in COVER_EXTENSIONS:
            candidate = found.get((name, ext))
            if candidate and user_can_read(request, candidate):
                return candidate
    return None


def _readable_audio_file(path: str, request: Request) -> Path:
    """Resolve a request path to a regular file the logged-in user may read, or raise 404/403."""
    p = get_safe_path(path)
    if not p.is_file():
        raise HTTPException(status_code=404, detail='File not found')
    require_readable(request, p)
    return p


def _fallback_meta(p: Path) -> dict:
    """Metadata used when ffprobe is missing or fails: the file name as title, everything else empty."""
    return {
        'title':           p.stem,
        'artist':          '',
        'album':           '',
        'date':            '',
        'format':          p.suffix.lstrip('.').upper(),
        'bits_per_sample': None,
        'sample_rate':     None,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get('/api/fs/audio-art')
def audio_art(path: str, request: Request):
    """
    Return album art for the given audio file.

    Tries embedded art first (via ffmpeg pipe), then a cover image in the
    same directory. Returns 404 if no art is found - the client renders a
    fallback icon instead.
    """
    p = _readable_audio_file(path, request)

    # 1. Embedded art (requires ffmpeg; a file with no image stream simply yields nothing)
    if shutil.which('ffmpeg'):
        art_bytes = _extract_embedded_art(p)
        mime = _detect_image_mime(art_bytes) if art_bytes else None
        if mime:
            return Response(
                content=art_bytes,
                media_type=mime,
                headers={'Cache-Control': 'max-age=3600'},
            )

    # 2. Directory cover file
    cover = _find_directory_art(request, p)
    if cover:
        mime, _ = mimetypes.guess_type(str(cover))
        mime = mime or 'image/jpeg'
        return FileResponse(
            path=str(cover),
            media_type=mime,
            headers={'Cache-Control': 'max-age=3600'},
        )

    # 3. No art found
    raise HTTPException(status_code=404, detail='No album art found')


@router.get('/api/fs/audio-meta')
def audio_meta(path: str, request: Request):
    """
    Return ID3 / Vorbis / FLAC tag metadata and stream info for an audio file.

    Never returns 404 for missing tags - absent fields are empty strings.
    Falls back to filename-as-title when ffprobe is unavailable or fails.
    """
    p = _readable_audio_file(path, request)

    if not shutil.which('ffprobe'):
        return _fallback_meta(p)

    try:
        result = subprocess.run(
            [
                'ffprobe', '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                str(p),
            ],
            capture_output=True,
            text=True,
            timeout=PROBE_TIMEOUT_SECONDS,
            stdin=subprocess.DEVNULL,
            check=False,
        )
        if result.returncode != 0:
            logger.warning("ffprobe exited %s for %s", result.returncode, p.name)
            return _fallback_meta(p)

        data = json.loads(result.stdout)

        # Tags live under format.tags in most containers
        tags = data.get('format', {}).get('tags', {})
        # Normalise tag key casing (some muxers use uppercase)
        tags = {k.lower(): v for k, v in tags.items()}

        # Extract first audio stream for technical details
        audio_stream = next(
            (s for s in data.get('streams', []) if s.get('codec_type') == 'audio'),
            {}
        )

        fmt_name = data.get('format', {}).get('format_name', '').split(',')[0].upper()
        codec    = audio_stream.get('codec_name', '').upper()

        return {
            'title':           tags.get('title', p.stem),
            'artist':          tags.get('artist', tags.get('album_artist', '')),
            'album':           tags.get('album', ''),
            'date':            tags.get('date', tags.get('year', '')),
            'format':          codec or fmt_name,
            'bits_per_sample': audio_stream.get('bits_per_raw_sample') or audio_stream.get('bits_per_sample'),
            'sample_rate':     audio_stream.get('sample_rate'),
        }

    except (OSError, subprocess.TimeoutExpired, ValueError, AttributeError) as exc:
        logger.warning("ffprobe metadata failed for %s: %s", p.name, exc)
        return _fallback_meta(p)
