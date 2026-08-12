const CACHE_NAME         = 'sovereign-video-v1';
const META_DB_NAME       = 'sovereign-cache-meta';
const META_DB_VERSION    = 1;
const META_STORE         = 'video-cache-meta';
const MAX_FILE_BYTES     = 1_572_864_000;   // 1.5 GB
const MAX_TOTAL_BYTES    = 5_368_709_120;   // 5 GB
const MAX_AGE_MS         = 24 * 60 * 60 * 1000; // 24 hours

function openMetaDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(META_DB_NAME, META_DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        const store = db.createObjectStore(META_STORE, { keyPath: 'url' });
        store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function writeMetaEntry(url, path, size) {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    const now = Date.now();
    const req = store.put({ url, path, size, cachedAt: now, lastAccessed: now });
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e.target.error);
  });
}

// Tracks the last time we actually wrote lastAccessed to IDB for each URL.
// Chrome's media pipeline fires dozens of range requests per second during
// playback. Without debouncing, every request would open an IDB transaction
// for a write that has no effect on correctness during active playback.
// 30 seconds is frequent enough for LRU accuracy without mobile I/O pressure.
const _lastAccessedWritten = new Map();
const LAST_ACCESSED_DEBOUNCE_MS = 30_000;

async function updateLastAccessed(url) {
  const now = Date.now();
  const lastWritten = _lastAccessedWritten.get(url) ?? 0;
  if (now - lastWritten < LAST_ACCESSED_DEBOUNCE_MS) return; // skip — written recently
  _lastAccessedWritten.set(url, now);

  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    const req = store.get(url);
    req.onsuccess = e => {
      const entry = e.target.result;
      if (entry) {
        entry.lastAccessed = now;
        store.put(entry);
      }
      resolve();
    };
    req.onerror = e => reject(e.target.error);
  });
}

async function getAllMeta() {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const store = tx.objectStore(META_STORE);
    const req = store.getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function deleteEntry(url) {
  // Delete from Cache API
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(url);
  } catch (err) {
    console.error('Failed to delete from cache', err);
  }
  
  // Delete from IDB
  try {
    const db = await openMetaDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readwrite');
      const store = tx.objectStore(META_STORE);
      const req = store.delete(url);
      req.onsuccess = () => resolve();
      req.onerror = e => reject(e.target.error);
    });
  } catch (err) {
    console.error('Failed to delete from IDB', err);
  }
}

async function sweepExpired() {
  try {
    const entries = await getAllMeta();
    let swept = 0;
    const now = Date.now();
    for (const entry of entries) {
      if (now - entry.cachedAt > MAX_AGE_MS) {
        await deleteEntry(entry.url);
        swept++;
      }
    }
    console.log(`Swept ${swept} expired cache entries.`);
  } catch (err) {
    console.error('Error sweeping expired entries', err);
  }
}

async function evictToFit(newFileSize) {
  try {
    const entries = await getAllMeta();
    let totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
    if (totalBytes + newFileSize <= MAX_TOTAL_BYTES) {
      return;
    }
    
    entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
    for (const entry of entries) {
      console.log(`Evicting ${entry.url} to free space.`);
      await deleteEntry(entry.url);
      totalBytes -= entry.size;
      if (totalBytes + newFileSize <= MAX_TOTAL_BYTES) {
        break;
      }
    }
  } catch (err) {
    console.error('Error evicting to fit space', err);
  }
}

async function postMessageAll(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach(c => c.postMessage(msg));
}

// Prevents duplicate background DLs if Plyr fires multiple range requests
// before the first download completes.
const _inProgress = new Set();

async function backgroundCache(url, path) {
  if (_inProgress.has(url)) return;
  _inProgress.add(url);
  try {
    // Fetch the full file without range.
    // X-SW-Bypass header tells the fetch handler to skip interception so we
    // don't recurse back into backgroundCache.
    const res = await fetch(url, { headers: { 'X-SW-Bypass': '1' } });
    if (!res.ok) {
      throw new Error(`Fetch failed with status ${res.status}`);
    }

    const lengthHeader = res.headers.get('Content-Length');
    if (!lengthHeader) {
      postMessageAll({ type: 'cache-skip', path, reason: 'unknown-size' });
      return;
    }

    const contentLength = parseInt(lengthHeader, 10);
    if (contentLength > MAX_FILE_BYTES) {
      postMessageAll({ type: 'cache-skip', path });
      return;
    }

    await evictToFit(contentLength);

    const cache = await caches.open(CACHE_NAME);

    // Use the standard clone-and-cache pattern.
    // cache.put(url, res.clone()) is the approach Chrome's CacheStorage API is
    // specifically designed for — it stores the cloned Response natively.
    // Manually constructing new Response(readableStream) from a TransformStream
    // can result in an empty body being stored, which breaks blob() later.
    // We read the ORIGINAL body for progress tracking; the clone goes to cache.
    const resForCache = res.clone();
    const cacheWritePromise = cache.put(url, resForCache);

    const reader = res.body.getReader();
    let receivedBytes = 0;
    let lastReported = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      const percent = (receivedBytes / contentLength) * 100;
      if (Math.floor(percent / 5) > Math.floor(lastReported / 5)) {
        postMessageAll({ type: 'cache-progress', path, percent });
        lastReported = percent;
      }
    }

    // Wait for the cache write to fully complete before marking done
    await cacheWritePromise;

    await writeMetaEntry(url, path, contentLength);
    postMessageAll({ type: 'cache-complete', path });

  } catch (err) {
    console.error(`Background cache error for ${url}:`, err);
  } finally {
    _inProgress.delete(url);
  }
}

self.addEventListener('install', event => {
  console.log('Service Worker installing.');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating.');
  event.waitUntil(
    clients.claim().then(() => sweepExpired())
  );
});

// Session-sticky transport tracking.
// Maximum chunk size (2 MB) for synthetic 206 range responses served from SW cache.
// Chromium's Service Worker IPC layer (ServiceWorkerSubresourceLoader) fails
// with MOJO_RESULT_RESOURCE_EXHAUSTED if a single 206 Response body delivers a
// multi-hundred megabyte blob. Capping chunks at 2 MB ensures fast, reliable,
// chunked streaming directly from CacheStorage (even offline).
const MAX_CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB

const activeNetworkSessions = new Set();

// React fires this before mounting any <video> element so backgroundCache
// starts without going through the fetch-intercept path.
// IMPORTANT: we derive the normalized URL here from path (+ optional native flag)
// using URLSearchParams — the same encoding the fetch handler uses — so both
// sides produce the same cache key and cache.match() finds the entry on the
// first range request.
self.addEventListener('message', event => {
  if (event.data?.type === 'start-cache') {
    const { path, native } = event.data;
    if (path) {
      const normalizedParams = new URLSearchParams({ path });
      if (native) normalizedParams.set('native', '1');
      const normalizedUrl = `${self.location.origin}/api/fs/stream?${normalizedParams.toString()}`;
      backgroundCache(normalizedUrl, path);
    }
  }
});

self.addEventListener('fetch', event => {
  // SW-internal fetches (e.g. backgroundCache) carry this header — pass straight through.
  if (event.request.headers.get('X-SW-Bypass')) return;

  if (event.request.url.includes('/api/fs/stream')) {
    console.log('Intercepting stream request:', event.request.url);
    const urlObj = new URL(event.request.url);
    const path   = urlObj.searchParams.get('path');

    // ── Audio guard ───────────────────────────────────────────────────────────
    // Audio files are served directly by the browser's <audio> element via HTTP
    // range requests. They must NOT be intercepted or cached here — lossless
    // files (WAV, FLAC) can be gigabytes in size, and buffering them in the
    // Cache API / memory would cause catastrophic memory exhaustion.
    // The audio player component manages its own network requests directly.
    const AUDIO_EXTS = new Set([
      'mp3','flac','wav','aac','m4a','ogg','oga','opus','wma','aiff','aif','alac','ape','wv','mka',
    ]);
    const pathExt = path ? path.split('.').pop()?.toLowerCase() : '';
    if (AUDIO_EXTS.has(pathExt)) return; // pass through — never cache audio
    // ─────────────────────────────────────────────────────────────────────────
    // Normalize the cache key: rebuild from URLSearchParams so that %20 and +
    // both resolve to the same canonical URL regardless of how the browser or
    // the SW's internal fetch encoded the query string.
    // Include the 'native' flag so native-served files (stream?path=...&native=1)
    // have a distinct cache key from their remuxed counterparts.
    const native = urlObj.searchParams.get('native');
    const normalizedParams = new URLSearchParams({ path });
    if (native === '1') normalizedParams.set('native', '1');
    const baseUrl    = urlObj.origin + urlObj.pathname + '?' + normalizedParams.toString();
    const sid        = urlObj.searchParams.get('sid') || '';
    const sessionKey = sid ? `${baseUrl}&sid=${sid}` : baseUrl;
    const rangeHeader = event.request.headers.get('Range') || '';

    event.respondWith((async () => {
      // If this active player mount instance started on the network, keep ALL
      // mid-stream range requests for this session on the network to prevent Chromium
      // MultiBufferDataSource transport-switching crashes.
      if (activeNetworkSessions.has(sessionKey)) {
        return fetch(event.request);
      }

      const cache  = await caches.open(CACHE_NAME);
      const cached = await cache.match(baseUrl);

      if (cached) {
        // Warm cache hit for a new player mount instance! Serve cleanly from cache.
        const blob      = await cached.blob();
        const totalSize = blob.size;

        if (totalSize === 0) {
          console.error('[SW] Corrupt cache entry (empty blob) for', baseUrl, '— falling back to network');
          return fetch(event.request);
        }

        // Infer MIME type with case-insensitive header lookup and magic-byte header verification.
        // Remuxed containers (e.g. .mkv -> .mp4 or .webm) must be assigned their true container MIME
        // type rather than defaulting based on original file extension.
        let contentType = cached.headers.get('content-type') || cached.headers.get('Content-Type');
        if (!contentType || contentType === 'application/octet-stream') {
          try {
            const headerBuf = await blob.slice(0, 12).arrayBuffer();
            const bytes = new Uint8Array(headerBuf);
            // MP4 container magic header: 'ftyp' at bytes 4..7 (0x66 0x74 0x79 0x70)
            if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
              contentType = 'video/mp4';
            } else {
              contentType = 'video/webm';
            }
          } catch (_) {
            contentType = 'video/webm';
          }
        }

        if (!rangeHeader) {
          // No range — serve full file (or first chunk if oversized)
          await updateLastAccessed(baseUrl);
          return new Response(blob, {
            status: 200,
            headers: {
              'Content-Type':   contentType,
              'Content-Length': String(totalSize),
              'Accept-Ranges':  'bytes',
            },
          });
        }

        console.log(`[SW] Serving from cache: ${path}, blob=${totalSize} bytes (range: ${rangeHeader})`);

        // RFC 7233-compliant range parser with 2 MB chunk capping.
        let start = 0;
        let end   = totalSize - 1;

        try {
          const parts    = rangeHeader.replace(/bytes=/, '').split('-');
          const startStr = parts[0] ? parts[0].trim() : '';
          const endStr   = parts[1] ? parts[1].trim() : '';

          if (startStr === '' && endStr !== '') {
            // Suffix range: bytes=-500 (last 500 bytes)
            const suffixLength = parseInt(endStr, 10);
            start = Math.max(0, totalSize - suffixLength);
            end   = totalSize - 1;
          } else if (startStr !== '' && endStr === '') {
            // Open range: bytes=500- (cap chunk to MAX_CHUNK_SIZE)
            start = parseInt(startStr, 10);
            end   = Math.min(start + MAX_CHUNK_SIZE - 1, totalSize - 1);
          } else if (startStr !== '' && endStr !== '') {
            // Closed range: bytes=500-999 (cap to MAX_CHUNK_SIZE)
            start = parseInt(startStr, 10);
            const reqEnd = parseInt(endStr, 10);
            end   = Math.min(reqEnd, start + MAX_CHUNK_SIZE - 1, totalSize - 1);
          }
        } catch (_) {
          // Malformed range header — serve starting chunk as 200
          await updateLastAccessed(baseUrl);
          return new Response(blob.slice(0, MAX_CHUNK_SIZE), {
            status: 200,
            headers: {
              'Content-Type':   contentType,
              'Content-Length': String(Math.min(MAX_CHUNK_SIZE, totalSize)),
              'Accept-Ranges':  'bytes',
            },
          });
        }

        if (isNaN(start) || isNaN(end) || start >= totalSize || end >= totalSize || start > end) {
          return new Response(null, {
            status: 416,
            statusText: 'Range Not Satisfiable',
            headers: { 'Content-Range': `bytes */${totalSize}` },
          });
        }

        await updateLastAccessed(baseUrl);
        const slicedBlob = blob.slice(start, end + 1);

        return new Response(slicedBlob, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Type':   contentType,
            'Content-Range':  `bytes ${start}-${end}/${totalSize}`,
            'Content-Length': String(slicedBlob.size),
            'Accept-Ranges':  'bytes',
            'Cache-Control':  'no-cache',
          },
        });

      } else {
        // Cache miss — mark this unique player session instance as network and start background download
        activeNetworkSessions.add(sessionKey);
        event.waitUntil(backgroundCache(baseUrl, path));
        return fetch(event.request);
      }
    })());
  }
});

