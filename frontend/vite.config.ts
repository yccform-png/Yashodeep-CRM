import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',        // We handle the update prompt ourselves (not auto-reload)
      includeAssets: [
        'favicon.ico',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'android-chrome-192x192.png',
        'android-chrome-512x512.png',
        'icon-512-maskable.png',
      ],
      manifest: {
        name: 'Yashodeep Coaching Classes ERP',
        short_name: 'YCC ERP',
        description: 'Unified Coaching, Residential Hostel & Study Room Management System',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        lang: 'en',
        categories: ['education', 'business', 'productivity'],
        icons: [
          {
            src: '/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'New Admission',
            short_name: 'Admission',
            description: 'Enrol a new student',
            url: '/admissions/new',
            icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Students Registry',
            short_name: 'Students',
            description: 'View all enrolled students',
            url: '/students',
            icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Collect Fee',
            short_name: 'Fees',
            description: 'Open the fee management module',
            url: '/fees',
            icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // Static asset precaching
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Runtime caching rules
        runtimeCaching: [
          // Google Fonts — cache-first (they never change for a given URL)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Backend API — network-first (live data must always be fresh)
          {
            urlPattern: /^https:\/\/yashodeep-crm\.onrender\.com\/api\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ycc-api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 }, // 5-min stale fallback
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Do NOT force update until user manually confirms (protects mid-session work)
        skipWaiting: false,
        clientsClaim: false,
      },
      devOptions: {
        enabled: false, // Keep SW disabled in dev mode
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
