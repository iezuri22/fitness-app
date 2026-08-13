import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Set only by `npm run preview:ui`. Never set in a real build. */
const UI_PREVIEW = process.env.VITE_UI_PREVIEW === '1'

/**
 * UI preview mode: point every `lib/db` import at the in-memory fixture
 * module instead of Firestore, so the real screens can be worked on without
 * signing in. Resolving through `this.resolve` first means it catches the
 * import no matter which relative specifier a file used.
 *
 * Off unless VITE_UI_PREVIEW=1, so production bundles never see db.preview.
 */
function uiPreviewDbSwap(): Plugin {
  return {
    name: 'ui-preview-db-swap',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!UI_PREVIEW || !importer) return null
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      })
      if (resolved && /[\\/]src[\\/]lib[\\/]db\.ts$/.test(resolved.id)) {
        return resolved.id.replace(/db\.ts$/, 'db.preview.ts')
      }
      return null
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Stamped at build time — shown in Settings so users can verify they're on
  // the latest deploy after tapping "Check for updates".
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    'import.meta.env.VITE_UI_PREVIEW': JSON.stringify(UI_PREVIEW ? '1' : ''),
  },
  plugins: [
    uiPreviewDbSwap(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Lift — Workout Logger',
        short_name: 'Lift',
        description: 'Private workout logger with PT routine support.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // App shell only. /gifs/ is ~100MB of exercise demos — precaching that
        // would mean a 100MB download on install, so it's handled at runtime
        // by the CacheFirst rule below instead.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        globIgnores: ['gifs/**'],
        runtimeCaching: [
          {
            // Every demo you actually look at is kept, so it works offline
            // afterwards (gym wifi is a lottery). They're content-addressed by
            // filename and never mutate, so CacheFirst is safe — a changed
            // demo ships under a new name.
            urlPattern: /\/gifs\/.*\.(?:gif|jpe?g|png|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-demos',
              expiration: {
                maxEntries: 600,
                maxAgeSeconds: 60 * 60 * 24 * 365,
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Split the two big vendors out of the app chunk — Firebase alone is
        // ~500kB. Keeps the app code hot-cacheable and silences the >500kB
        // chunk warning.
        manualChunks: {
          firebase: [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/storage',
          ],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
