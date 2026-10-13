/**
 * Audio player: a Plyr audio control with a decorative waveform and the file name.
 */

import { useState, useEffect, useRef } from 'react';
import Plyr from 'plyr';
import { Music } from 'lucide-react';
import { stopMedia } from './FileViewer.shared';

/* ─── Audio player (Plyr) ──────────────────────────────────────────────────── */
// Number of decorative waveform bars — pure CSS height variation, no Web Audio API.
const WAVE_BAR_COUNT = 40;

export function AudioPlayer({ path, filename }) {
  const audioRef  = useRef(null);
  const playerRef = useRef(null);

  const [meta, setMeta]     = useState(null);   // { title, artist, album, format, bits_per_sample, sample_rate }
  const [artError, setArtError] = useState(false);

  // Art: the URL is used directly — the <img> onError handler in the JSX below
  // catches 404s cleanly, saving a redundant HEAD request (and a second full
  // ffprobe + ffmpeg run) on every audio file open.
  const artUrl = `/api/fs/audio-art?path=${encodeURIComponent(path)}`;

  // Fetch metadata on mount; a reply that arrives after unmount is dropped.
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/fs/audio-meta?path=${encodeURIComponent(path)}`)
      .then(r => r.ok ? r.json() : null)
      .then(metaData => {
        if (cancelled) return;
        if (metaData) setMeta(metaData);
      })
      .catch(() => {
        // Tags are optional; the card falls back to the file name.
      });

    return () => { cancelled = true; };
  }, [path]);

  // Init Plyr audio player.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    try {
      playerRef.current = new Plyr(el, {
        controls: ['play', 'progress', 'current-time', 'duration', 'mute', 'volume'],
      });
    } catch (err) {
      console.error('[FileViewer] Plyr audio init failed:', err);
    }
    return () => {
      try { playerRef.current?.destroy(); } catch {
        // Plyr may already have torn down its markup; the element is stopped below.
      }
      playerRef.current = null;
      stopMedia(el);
    };
  }, []);

  // Format technical sub-label: e.g. "FLAC · 24-bit / 96 kHz"
  const techLabel = (() => {
    if (!meta) return null;
    const parts = [meta.format].filter(Boolean);
    if (meta.bits_per_sample) parts.push(`${meta.bits_per_sample}-bit`);
    if (meta.sample_rate) {
      const khz = (parseInt(meta.sample_rate, 10) / 1000).toFixed(1).replace(/\.0$/, '');
      parts.push(`${khz} kHz`);
    }
    return parts.length > 1 ? parts.join(' · ') : parts[0] || null;
  })();

  const displayTitle  = meta?.title  || filename;
  const displayArtist = meta?.artist || '';
  const displayAlbum  = meta?.album  || '';

  return (
    <div className="viewer-audio-frame">
      <div className="viewer-audio-card">

        {/* Top row: art panel + metadata */}
        <div className="viewer-audio-top">
          <div className="viewer-audio-art-panel">
            {!artError
              ? <img
                  src={artUrl}
                  alt="Album art"
                  className="viewer-audio-art-img"
                  onError={() => setArtError(true)}
                />
              : <Music size={48} className="viewer-audio-art-icon" />
            }
          </div>
          <div className="viewer-audio-meta">
            <span className="viewer-audio-title">{displayTitle}</span>
            {displayArtist && <span className="viewer-audio-artist">{displayArtist}</span>}
            {displayAlbum  && <span className="viewer-audio-album">{displayAlbum}</span>}
            {techLabel     && <span className="viewer-audio-tech">{techLabel}</span>}
          </div>
        </div>

        {/* Decorative waveform — static CSS, no live audio data */}
        <div className="viewer-audio-wave" aria-hidden="true">
          {Array.from({ length: WAVE_BAR_COUNT }, (_, i) => (
            <span key={i} className="viewer-audio-wave-bar" />
          ))}
        </div>

        {/* Plyr audio controls */}
        <div className="viewer-audio-player-wrap">
          <audio
            ref={audioRef}
            src={`/api/fs/stream?path=${encodeURIComponent(path)}`}
            controls
          />
        </div>

      </div>
    </div>
  );
}
