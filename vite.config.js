import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// On GitHub Pages the app is served from /fitness-website/. Locally it stays at
// root so `npm run dev` and the preview server work unchanged.
const base = process.env.DEPLOY_TARGET === 'gh-pages' ? '/fitness-website/' : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: { config: true },
      manifest: {
        name: 'Leon — Fitness Coaching & Tools',
        short_name: 'Leon',
        description: 'Free fitness calculators and a workout log, plus 1:1 coaching with Leon.',
        theme_color: '#FAF9F6',
        background_color: '#FAF9F6',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache static assets for offline use, but NOT index.html — pages
        // are fetched fresh from the network (see runtimeCaching) so new deploys
        // show up immediately instead of being served from a stale cache.
        globPatterns: ['**/*.{js,css,svg,png,jpg,jpeg,webp,ico,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Disable the default precache-based navigation fallback (index.html is
        // no longer precached); the network-first rule below handles navigations.
        navigateFallback: null,
        runtimeCaching: [
          {
            // HTML navigations: network-first, so updates are instant online;
            // falls back to the cached page only when offline.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages', networkTimeoutSeconds: 3 },
          },
        ],
      },
    }),
  ],
})
