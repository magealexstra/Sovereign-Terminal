const CACHE_NAME         = 'sovereign-video-v1';
const META_DB_NAME       = 'sovereign-cache-meta';
const META_DB_VERSION    = 1;
const META_STORE         = 'video-cache-meta';
const STREAM_PATH        = '/api/fs/stream';
const MAX_FILE_BYTES     = 1_572_864_000;   // 1.5 GB
const MAX_TOTAL_BYTES    = 5_368_709_120;   // 5 GB
const MAX_AGE_MS         = 24 * 60 * 60 * 1000; // 24 hours
const FRESHNESS_TIMEOUT_MS = 3_000;
const MAX_REMEMBERED     = 200;

// Metadata rows live in IndexedDB, one per cached file:
//   { url, path, size, cachedAt, lastAccessed, complete }
// A row is written before the bytes are stored and marked complete after, so every byte in the
// cache has a row that eviction and expiry can find. A row without `complete` was written by an
// earlier version, which wrote it only after the bytes were stored, and counts as complete.

let _dbPromise = null;

function openMetaDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(META_DB_NAME, META_DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        const store = db.createObjectStore(META_STORE, { keyPath: 'url' });
        store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
      }
    };
    req.onsuccess = e => {
      const db = e.target.result;
      // Another version of the page asking to upgrade, or the browser closing the
      // connection, must not leave this worker holding a dead connection.
      db.onversionchange = () => { db.close(); _dbPromise = null; };
      db.onclose = () => { _dbPromise = null; };
      resolve(db);
    };
    req.onerror = e => { _dbPromise = null; reject(e.target.error); };
  });
  return _dbPromise;
}

// Runs one request inside a transaction and resolves with its result once the transaction committed.
async function metaTransaction(mode, run) {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, mode);
    const req = run(tx.objectStore(META_STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = e => reject(e.target.error);
    tx.onabort = e => reject(e.target.error);
  });
}

function writeMetaEntry(url, path, size, complete) {
  const now = Date.now();
  return metaTransaction('readwrite', store =>
    store.put({ url, path, size, cachedAt: now, lastAccessed: now, complete }));
}

function getMetaEntry(url) {
  return metaTransaction('readonly', store => store.get(url));
}

async function markComplete(url) {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    const req = store.get(url);
    req.onsuccess = e => {
      const entry = e.target.result;
      if (entry) store.put({ ...entry, complete: true });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e.target.error);
    tx.onabort = e => reject(e.target.error);
  });
}

// Remembers a value under a key, forgetting the oldest keys beyond MAX_REMEMBERED.
function remember(map, key, value) {
  map.delete(key);
  map.set(key, value);
  while (map.size > MAX_REMEMBERED) map.delete(map.keys().next().value);
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
  remember(_lastAccessedWritten, url, now);

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
    };
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e.target.error);
    tx.onabort = e => reject(e.target.error);
  });
}

function getAllMeta() {
  return metaTransaction('readonly', store => store.getAll());
}

// The two most recently served files, as Blobs: a Blob from the cache is backed by disk, so
// keeping the handle spares each range request a cache lookup and a re-read of the body.
const _blobMemo = new Map();
const BLOB_MEMO_SIZE = 2;

async function getCachedBlob(url) {
  const memo = _blobMemo.get(url);
  if (memo) return memo;
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(url);
  if (!cached) return null;
  const blob = await cached.blob();
  const entry = { blob, headerType: cached.headers.get('content-type') };
  _blobMemo.set(url, entry);
  while (_blobMemo.size > BLOB_MEMO_SIZE) _blobMemo.delete(_blobMemo.keys().next().value);
  return entry;
}

async function deleteEntry(url) {
  _blobMemo.delete(url);

  // Delete from Cache API
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(url);
  } catch (err) {
    console.error('Failed to delete from cache', err);
  }

  // Delete from IDB
  try {
    await metaTransaction('readwrite', store => store.delete(url));
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
      if (now - entry.cachedAt > MAX_AGE_MS && !_inProgress.has(entry.url)) {
        await deleteEntry(entry.url);
        swept++;
      }
    }
    if (swept > 0) console.log(`Swept ${swept} expired cache entries.`);
  } catch (err) {
    console.error('Error sweeping expired entries', err);
  }
}

// Brings the cache and the metadata back in step after a worker was stopped mid-download:
// bytes with no row, rows still marked incomplete, and complete rows whose bytes are gone are all removed.
async function reconcileCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const rows = await getAllMeta();
    const rowUrls = new Set(rows.map(row => row.url));
    for (const request of await cache.keys()) {
      if (!rowUrls.has(request.url)) await cache.delete(request);
    }
    for (const row of rows) {
      const incomplete = row.complete === false;
      if (incomplete || !(await cache.match(row.url))) await deleteEntry(row.url);
    }
  } catch (err) {
    console.error('Error reconciling the video cache', err);
  }
}

async function evictToFit(newFileSize) {
  try {
    const entries = await getAllMeta();
    let totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
    if (totalBytes + newFileSize <= MAX_TOTAL_BYTES) {
      return;
    }

    // A file being downloaded right now is not a candidate: removing it would orphan its bytes.
    const candidates = entries.filter(entry => !_inProgress.has(entry.url));
    candidates.sort((a, b) => a.lastAccessed - b.lastAccessed);
    for (const entry of candidates) {
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

// Runs once per worker start, before any download: a download started by an earlier worker
// instance cannot still be running, so whatever it left behind is removed first.
const _startupReconcile = reconcileCache();

async function backgroundCache(url, path) {
  if (_inProgress.has(url)) return;
  _inProgress.add(url);
  let rowWritten = false;
  let stored = false;
  try {
    await _startupReconcile;

    // A device asking to save data does not get a second copy of the file downloaded behind its back.
    if (self.navigator?.connection?.saveData) return;

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

    // The row goes in first (marked incomplete), so the bytes below always have a row to be found by.
    await writeMetaEntry(url, path, contentLength, false);
    rowWritten = true;

    // Use the standard clone-and-cache pattern.
    // cache.put(url, res.clone()) is the approach Chrome's CacheStorage API is
    // specifically designed for — it stores the cloned Response natively.
    // Manually constructing new Response(readableStream) from a TransformStream
    // can result in an empty body being stored, which breaks blob() later.
    // We read the ORIGINAL body for progress tracking; the clone goes to cache.
    const resForCache = res.clone();
    const cacheWritePromise = cache.put(url, resForCache);
    // If the body fails while it is being read below, that error is the one reported; the write's
    // own rejection is still awaited on the success path.
    cacheWritePromise.catch(() => {});

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
    stored = true;

    _blobMemo.delete(url);
    await markComplete(url);
    postMessageAll({ type: 'cache-complete', path });

  } catch (err) {
    console.error(`Background cache error for ${url}:`, err);
  } finally {
    // A download that did not finish leaves neither bytes nor a row behind.
    if (rowWritten && !stored) await deleteEntry(url);
    _inProgress.delete(url);
  }
}

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    self.clients.claim().then(() => _startupReconcile).then(() => sweepExpired())
  );
});

// Maximum chunk size (2 MB) for synthetic 206 range responses served from SW cache.
// Chromium's Service Worker IPC layer (ServiceWorkerSubresourceLoader) fails
// with MOJO_RESULT_RESOURCE_EXHAUSTED if a single 206 Response body delivers a
// multi-hundred megabyte blob. Capping chunks at 2 MB ensures fast, reliable,
// chunked streaming directly from CacheStorage (even offline).
const MAX_CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB

// Session-sticky transport tracking: a player mount that started on the network stays on the
// network for all its range requests.
const activeNetworkSessions = new Map();

// The cache key for a stream URL: rebuilt from URLSearchParams so that %20 and +
// both resolve to the same canonical URL regardless of how the browser or
// the SW's internal fetch encoded the query string. The 'native' flag is part of the
// key, so native-served files have a distinct key from their remuxed counterparts.
function cacheKeyFor(path, native) {
  const params = new URLSearchParams({ path });
  if (native) params.set('native', '1');
  return `${self.location.origin}${STREAM_PATH}?${params.toString()}`;
}

// React fires this before mounting any <video> element so backgroundCache
// starts without going through the fetch-intercept path. The key is derived the
// same way the fetch handler derives it, so cache.match() finds the entry on the
// first range request.
self.addEventListener('message', event => {
  if (event.data?.type === 'start-cache') {
    const { path, native } = event.data;
    if (path) {
      event.waitUntil(backgroundCache(cacheKeyFor(path, native), path));
    }
  }
});

// Parses a Range header against a body of totalSize bytes and caps the span at MAX_CHUNK_SIZE.
// Returns { start, end } (inclusive), or null when the header is not a single satisfiable byte range.
function parseRange(rangeHeader, totalSize) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;

  let start;
  let end;
  if (match[1] === '') {
    // Suffix range: bytes=-500 (last 500 bytes)
    start = Math.max(0, totalSize - Number(match[2]));
    end   = totalSize - 1;
  } else {
    start = Number(match[1]);
    end   = match[2] === '' ? totalSize - 1 : Math.min(Number(match[2]), totalSize - 1);
  }
  if (start >= totalSize || start > end) return null;
  return { start, end: Math.min(end, start + MAX_CHUNK_SIZE - 1) };
}

// Asks the server for the first byte of the file and reads the full size from the answer.
// Resolves to the size, null when it cannot be told, or the HTTP status when the server refused.
async function remoteFileSize(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FRESHNESS_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'X-SW-Bypass': '1', Range: 'bytes=0-0' },
      signal: controller.signal,
    });
    res.body?.cancel().catch(() => {});
    if (res.status === 401 || res.status === 403 || res.status === 404) return res.status;
    if (res.status === 206) {
      const total = /\/(\d+)$/.exec(res.headers.get('Content-Range') || '');
      return total ? Number(total[1]) : null;
    }
    const length = res.ok ? res.headers.get('Content-Length') : null;
    return length ? Number(length) : null;
  } catch {
    // Offline, or the server took too long (a remux that has to be rebuilt can run for minutes):
    // the copy in the cache is what plays.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Decides whether the cached copy of a file may be played:
//   'fresh'  - kept: young enough, and the server still reports the size it was stored with
//   'stale'  - removed: expired, replaced on the server (different size) or gone, or stored without a finished row
//   'denied' - the server refuses this browser (signed out): nothing is served from the cache
// Same-size replacements are not detected; the 24-hour expiry bounds how long one can play.
async function judgeCachedEntry(url) {
  const meta = await getMetaEntry(url).catch(() => undefined);
  if (!meta || meta.complete === false || Date.now() - meta.cachedAt > MAX_AGE_MS) return 'stale';

  const remote = await remoteFileSize(url);
  if (remote === 401 || remote === 403) return 'denied';
  if (remote === 404) return 'stale';
  if (remote !== null && remote !== meta.size) return 'stale';
  return 'fresh';
}

// One verdict per player mount: its range requests share the answer, so the check costs one request.
const _verdicts = new Map();

function verdictFor(sessionKey, url) {
  let verdict = _verdicts.get(sessionKey);
  if (!verdict) {
    verdict = judgeCachedEntry(url);
    remember(_verdicts, sessionKey, verdict);
  }
  return verdict;
}

// Audio files are served directly by the browser's <audio> element via HTTP range
// requests. They must NOT be intercepted or cached here — lossless files (WAV, FLAC)
// can be gigabytes in size, and buffering them in the Cache API / memory would cause
// catastrophic memory exhaustion. The audio player component manages its own requests.
const AUDIO_EXTS = new Set([
  'mp3','flac','wav','aac','m4a','ogg','oga','opus','wma','aiff','aif','alac','ape','wv','mka',
]);

// Infers the container MIME type of a cached file when the stored response did not say.
// Remuxed containers (e.g. .mkv -> .mp4 or .webm) must be assigned their true container MIME
// type rather than defaulting based on original file extension.
async function sniffContentType(blob, headerType) {
  if (headerType && headerType !== 'application/octet-stream') return headerType;
  try {
    const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    // MP4 container magic header: 'ftyp' at bytes 4..7 (0x66 0x74 0x79 0x70)
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      return 'video/mp4';
    }
  } catch {
    // An unreadable header falls through to the WebM default.
  }
  return 'video/webm';
}

async function serveStream(event, urlObj, path) {
  const baseUrl    = cacheKeyFor(path, urlObj.searchParams.get('native') === '1');
  const sid        = urlObj.searchParams.get('sid') || '';
  const sessionKey = sid ? `${baseUrl}&sid=${sid}` : baseUrl;
  const rangeHeader = event.request.headers.get('Range') || '';

  // If this active player mount instance started on the network, keep ALL
  // mid-stream range requests for this session on the network to prevent Chromium
  // MultiBufferDataSource transport-switching crashes.
  if (activeNetworkSessions.has(sessionKey)) {
    return fetch(event.request);
  }

  // A file still being downloaded is not judged or served: its row is not complete yet.
  const entry = _inProgress.has(baseUrl) ? null : await getCachedBlob(baseUrl);
  if (entry) {
    const verdict = await verdictFor(sessionKey, baseUrl);
    if (verdict === 'denied') {
      return fetch(event.request);
    }
    if (verdict === 'fresh') {
      return serveFromCache(event.request, baseUrl, entry, rangeHeader);
    }
    await deleteEntry(baseUrl);
  }

  // Cache miss (or a stale copy just removed) — mark this unique player session instance as
  // network and start background download
  remember(activeNetworkSessions, sessionKey, true);
  event.waitUntil(backgroundCache(baseUrl, path));
  return fetch(event.request);
}

// Records the access for eviction order; a failure to record never fails the playback.
function touch(url) {
  updateLastAccessed(url).catch(err => console.error('Failed to record cache access', err));
}

async function serveFromCache(request, baseUrl, entry, rangeHeader) {
  const { blob } = entry;
  const totalSize = blob.size;

  if (totalSize === 0) {
    console.error('[SW] Corrupt cache entry (empty blob) for', baseUrl, '— removing it');
    await deleteEntry(baseUrl);
    return fetch(request);
  }

  const contentType = await sniffContentType(blob, entry.headerType);

  if (!rangeHeader) {
    // No range — serve full file
    touch(baseUrl);
    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type':   contentType,
        'Content-Length': String(totalSize),
        'Accept-Ranges':  'bytes',
      },
    });
  }

  const range = parseRange(rangeHeader, totalSize);
  if (!range) {
    return new Response(null, {
      status: 416,
      statusText: 'Range Not Satisfiable',
      headers: { 'Content-Range': `bytes */${totalSize}` },
    });
  }

  touch(baseUrl);
  const slicedBlob = blob.slice(range.start, range.end + 1);

  return new Response(slicedBlob, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type':   contentType,
      'Content-Range':  `bytes ${range.start}-${range.end}/${totalSize}`,
      'Content-Length': String(slicedBlob.size),
      'Accept-Ranges':  'bytes',
      'Cache-Control':  'no-cache',
    },
  });
}

self.addEventListener('fetch', event => {
  // SW-internal fetches (e.g. backgroundCache) carry this header — pass straight through.
  if (event.request.headers.get('X-SW-Bypass')) return;
  if (event.request.method !== 'GET') return;

  // Only the stream route itself: /api/fs/stream/probe and the other routes under it are answers
  // about a file, not the file, and are never stored.
  const urlObj = new URL(event.request.url);
  if (urlObj.origin !== self.location.origin || urlObj.pathname !== STREAM_PATH) return;

  const path = urlObj.searchParams.get('path');
  if (!path) return;

  const pathExt = path.split('.').pop()?.toLowerCase();
  if (AUDIO_EXTS.has(pathExt)) return; // pass through — never cache audio

  event.respondWith(serveStream(event, urlObj, path));
});
