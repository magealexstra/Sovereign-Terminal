"""
fs_audio.py — Audio metadata and album art endpoints.

Provides two endpoints used by the AudioPlayer component:

  GET /api/fs/audio-art?path=...
      Returns album art as an image response.
      Source priority:
        1. Embedded art in the audio file (ID3 / FLAC / M4A picture block)
        2. Cover image file in the same directory (cover.jpg, folder.png, …)
        3. 404 if neither found — client falls back to the Music icon

  GET /api/fs/audio-meta?path=...
      Returns ID3 / Vorbis / FLAC tag metadata and basic stream info.
      Never 404s on missing tags — returns empty strings for absent fields.
"""

import json
import mimetypes
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, FileResponse

from fs_api import get_safe_path

router = APIRouter()

# Cover image filenames to check when embedded art is absent, in preference order.
COVER_NAMES = [
    'cover', 'folder', 'album', 'front', 'artwork', 'thumb',
]
COVER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ffprobe_available() -> bool:
    try:
        r = subprocess.run(['ffprobe', '-version'], capture_output=True, timeout=3)
        return r.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def _has_embedded_art(p: Path) -> bool:
    """
    Return True if the file has a stream that ffprobe reports as type 'video'
    (which is how embedded album art is stored in MP3/FLAC/M4A/OGG files).
    """
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_streams', str(p)],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            return False
        data = json.loads(result.stdout)
        return any(
            s.get('codec_type') == 'video'
            for s in data.get('streams', [])
        )
    except Exception:
        return False


def _extract_embedded_art(p: Path) -> bytes | None:
    """
    Extract the first embedded image from an audio file via ffmpeg pipe.
    Returns raw image bytes or None on failure.
    """
    try:
        result = subprocess.run(
            [
                'ffmpeg', '-i', str(p),
                '-an',               # drop audio
                '-vcodec', 'copy',   # copy the image stream as-is
                '-frames:v', '1',    # only one frame (the cover art)
                '-f', 'image2',      # force image muxer
                'pipe:1',            # write to stdout
            ],
            capture_output=True,
            timeout=15,
        )
        if result.returncode == 0 and result.stdout:
            return result.stdout
        return None
    except Exception:
        return None


def _detect_image_mime(data: bytes) -> str:
    """Detect image MIME type from magic bytes."""
    if data[:4] == b'\x89PNG':
        return 'image/png'
    if data[:2] == b'\xff\xd8':
        return 'image/jpeg'
    if data[:4] in (b'RIFF',) and data[8:12] == b'WEBP':
        return 'image/webp'
    return 'image/jpeg'  # safe default for unknown art


def _find_directory_art(p: Path) -> Path | None:
    """
    Scan the file's parent directory for common cover image filenames.
    Case-insensitive. Returns the first match or None.
    """
    directory = p.parent
    for name in COVER_NAMES:
        for ext in COVER_EXTENSIONS:
            candidate = directory / (name + ext)
            if candidate.exists() and candidate.is_file():
                return candidate
            # Case-insensitive scan for non-lowercase filenames
            try:
                for f in directory.iterdir():
                    if f.stem.lower() == name and f.suffix.lower() == ext:
                        return f
            except OSError:
                pass
    return None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get('/api/fs/audio-art')
def audio_art(path: str):
    """
    Return album art for the given audio file.

    Tries embedded art first (via ffmpeg pipe), then a cover image in the
    same directory. Returns 404 if no art is found — the client renders a
    fallback icon instead.
    """
    p = get_safe_path(path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail='File not found')

    # 1. Embedded art (requires ffmpeg)
    if _ffprobe_available() and _has_embedded_art(p):
        art_bytes = _extract_embedded_art(p)
        if art_bytes:
            mime = _detect_image_mime(art_bytes)
            return Response(
                content=art_bytes,
                media_type=mime,
                headers={'Cache-Control': 'max-age=3600'},
            )

    # 2. Directory cover file
    cover = _find_directory_art(p)
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
def audio_meta(path: str):
    """
    Return ID3 / Vorbis / FLAC tag metadata and stream info for an audio file.

    Never returns 404 for missing tags — absent fields are empty strings.
    Falls back to filename-as-title when ffprobe is unavailable.
    """
    p = get_safe_path(path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail='File not found')

    # Graceful fallback when ffprobe is not installed
    if not _ffprobe_available():
        return {
            'title':          p.stem,
            'artist':         '',
            'album':          '',
            'date':           '',
            'format':         p.suffix.lstrip('.').upper(),
            'bits_per_sample': None,
            'sample_rate':    None,
        }

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
            timeout=10,
        )
        if result.returncode != 0:
            raise ValueError('ffprobe failed')

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

    except Exception:
        return {
            'title':           p.stem,
            'artist':          '',
            'album':           '',
            'date':            '',
            'format':          p.suffix.lstrip('.').upper(),
            'bits_per_sample': None,
            'sample_rate':     None,
        }
