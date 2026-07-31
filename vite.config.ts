import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
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
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F6F2EA',
        theme_color: '#F6F2EA',
        orientation: 'any',
        categories: ['utilities', 'photo', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
  build: { target: 'es2022', cssTarget: 'safari16' },
});
