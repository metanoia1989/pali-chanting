import { defineConfig } from 'vite'
import { resolve } from 'path'
import { VitePWA } from 'vite-plugin-pwa'
import htmlMinifier from 'vite-plugin-html-minifier'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  appType: 'mpa',
  resolve: {
    alias: {
      vue: 'vue/dist/vue.esm-bundler.js',
    },
  },
  build: {
    outDir: 'dist',
    cssMinify: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        landing: resolve(__dirname, 'landing.html'),
        404: resolve(__dirname, '404.html'),
      },
    },
  },
  plugins: [
    htmlMinifier({
      minifierOptions: {
        collapseWhitespace: true,
        removeComments: true,
        removeEmptyAttributes: true,
        minifyCSS: true,
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,txt,woff2,svg}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/audio\/.+\.mp3$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      manifest: {
        name: 'Pāli Chant — 巴利语唱诵精听',
        short_name: 'Pāli Chant',
        description: '巴利语唱诵精听与发音学习工具 — 单词级精准高亮、循环精听、离线可用',
        theme_color: '#f5f0e8',
        background_color: '#f5f0e8',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
})
