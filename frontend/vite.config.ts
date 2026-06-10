import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// ADK backend runs on :8002 in dev (moved from :8001 to avoid
// clashing with an unrelated local backend that also wants 8001). We proxy
// the ADK API routes so the browser talks same-origin. changeOrigin:false
// keeps the Host header as localhost:3000 so ADK's origin-check middleware
// accepts the proxied POSTs (with changeOrigin:true they'd 403 "origin not
// allowed").
const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8002';
const proxyOpts = {target: BACKEND, changeOrigin: false};

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/run': proxyOpts,
        '/run_sse': proxyOpts,
        '/apps': proxyOpts,
        '/list-apps': proxyOpts,
        '/exports': proxyOpts,
        '/conversations': proxyOpts,
        '/google-ads': proxyOpts,
        '/google-sheets': proxyOpts,
        '/feedback': proxyOpts,
      },
    },
  };
});
