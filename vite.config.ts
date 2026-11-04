import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base './' => deployable to any free static host (GitHub Pages / Netlify / Vercel)
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/pwa-192.png', 'icons/pwa-512.png', 'icons/pwa-512-maskable.png'],
      manifest: {
        name: 'JobPilot — Job Application Tracker',
        short_name: 'JobPilot',
        description: 'Personal, AI-assisted job application tracker. Local-first: your data stays in your browser.',
        lang: 'en',
        display: 'standalone',
        start_url: './',
        scope: './',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: './favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: './icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: './icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: './icons/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Inter + JetBrains Mono from Google Fonts: offline-safe, updated in the background
            urlPattern: /fonts\.(?:googleapis|gstatic)\.com/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'jobpilot-fonts', expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  base: './',
})
