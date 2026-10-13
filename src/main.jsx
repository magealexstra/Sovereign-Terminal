import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './context/AppContext';
import { dispatchCacheMessage } from './context/CacheStateContext';
import './index.css';

// ── Service Worker registration (production only) ──────────────────────────
// Guarded by import.meta.env.PROD so Vite HMR in dev mode is never interrupted.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    console.log('[SW] Registered. Scope:', reg.scope);
  }).catch((err) => {
    console.error('[SW] Registration failed:', err);
  });

  // Forward SW postMessages into CacheStateContext global state.
  // dispatchCacheMessage is a module-level singleton that the cache provider fills on render.
  // The provider is mounted only once the user is logged in; a message sent while it is not mounted is discarded.
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, path, percent } = event.data ?? {};
    if (!type || !path) return;
    dispatchCacheMessage({ type, path, percent });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
