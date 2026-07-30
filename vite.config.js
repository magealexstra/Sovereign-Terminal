import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
//
// Dev proxy: reads PORT from the project .env so the Vite dev server
// automatically targets the same port as the backend without manual editing.
// Default: 2069 (matches PORT in .env and docker-compose.yml).
//
// Proxy routes:
//   /api  — REST API (auth, fs, settings)
//   /ws   — WebSocket terminal sessions (/ws/terminal)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.PORT || '2069';
  const backendHttp = `http://localhost:${backendPort}`;
  const backendWs   = `ws://localhost:${backendPort}`;

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': backendHttp,
        '/ws': {
          target: backendWs,
          ws: true,
        },
      },
    },
  };
});
