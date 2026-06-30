import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { VitePWA } from 'vite-plugin-pwa'
import htmlMinifier from 'vite-plugin-html-minifier'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Collect all track data into the JS bundle ───
const TRACKS = [
  { id: '01', audio: '01.Homage Tisarana 礼敬佛陀 三皈依.mp3', json: '01.Homage Tisarana 礼敬佛陀 三皈依.json' },
  { id: '02', audio: '02.Main Puja 佛随念 礼敬七佛.mp3', json: '02.Main Puja 佛随念 礼敬七佛.json' },
  { id: '03', audio: '03.inviting the Devas 邀请诸天.mp3', json: '03.inviting the Devas 邀请诸天.json' },
  { id: '04', audio: '04.Maha Maṅgala Suttaṁ 大吉祥经.mp3', json: '04.Maha Maṅgala Suttaṁ 大吉祥经.json' },
  { id: '05', audio: '05.Karaniya metta Sutta 应行慈爱经.mp3', json: '05.Karaniya metta Sutta 应行慈爱经.json' },
  { id: '06', audio: '06.Kammā Vācanā  请求宽恕.mp3', json: '06.Kammā Vācanā  请求宽恕.json' },
]

function baiduAnalyticsPlugin() {
  const snippet = `var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?736963b93e68233998f84932a8dfc603";
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();`
  return {
    name: 'baidu-analytics',
    transformIndexHtml: {
      handler(html, ctx) {
        return [
          { tag: 'script', children: snippet, injectTo: 'head' },
        ]
      },
    },
  }
}

function paliDataPlugin() {
  const D = p => resolve(__dirname, 'data', p)
  let combined = {}
  return {
    name: 'pali-data',
    buildStart() {
      combined = {}
      for (const t of TRACKS) {
        const txt = t.audio.replace('.mp3', '.txt')
        const read = f => { try { return fs.readFileSync(D(f), 'utf-8') } catch { return '' } }
        combined[t.id] = {
          pali: read('pali/' + txt),
          json: JSON.parse(read('json/' + t.json) || '[]'),
          en: read('trans/en/' + txt),
          cn: read('trans/cn/' + txt),
        }
      }
    },
    resolveId(id) {
      if (id === 'virtual:pali-data') return '\0virtual:pali-data'
    },
    load(id) {
      if (id === '\0virtual:pali-data') return `export default ${JSON.stringify(combined)}`
    },
  }
}

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
    baiduAnalyticsPlugin(),
    paliDataPlugin(),
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
        globPatterns: ['**/*.{js,css,html,woff2,svg}'],
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
