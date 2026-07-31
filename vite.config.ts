import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * The app is mounted at izaias.xyz/compresso, so every emitted URL — assets,
 * the manifest, the service worker and its precache list — has to carry that
 * prefix. `base` is what makes that true everywhere at once.
 */
const BASE = '/compresso/';
const SCOPE = '/compresso';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        name: 'Compresso — Image Optimizer',
        short_name: 'Compresso',
        description:
          'Compress, resize and convert images. Runs entirely on your device — nothing is uploaded. Works offline.',
        // No trailing slash: that is the URL people are given, and a scope of
        // '/compresso/' would not cover it — scope matching is a plain string
        // prefix, so '/compresso' is outside '/compresso/'.
        start_url: SCOPE,
        scope: SCOPE,
        id: SCOPE,
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#000000',
        orientation: 'any',
        categories: ['utilities', 'photo', 'productivity'],
        icons: [
          { src: BASE + 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: BASE + 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: BASE + 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: BASE + 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // Fonts and the worker chunk are part of the product, not extras — they are
        // precached so the app is genuinely complete offline.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  worker: { format: 'es' },
  // Emitted into dist/compresso so the deployment literally serves the same
  // paths the base declares — no rewrite layer to keep in sync.
  build: { target: 'es2022', cssTarget: 'safari16', outDir: 'dist/compresso', emptyOutDir: true },
});
