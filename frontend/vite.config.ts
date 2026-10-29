import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'AgriSense',
        short_name: 'AgriSense',
        description: 'Check tomato and potato leaves for disease',
        theme_color: '#274636',
        background_color: '#fbf5e6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Advice pack and schemes: works offline, refreshes in the background.
            urlPattern: ({ url }) => /\/api\/(advice-pack|schemes)/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'agrisense-content', expiration: { maxEntries: 20 } },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  // fs.allow: the on-phone model code lives in ../ml/inference (Vedant's folder).
  server: { proxy: { '/api': 'http://localhost:8000' }, fs: { allow: ['..'] } },
  preview: { proxy: { '/api': 'http://localhost:8000' } },
  test: { environment: 'node' },
} as never);
