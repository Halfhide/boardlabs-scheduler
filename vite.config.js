/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import bggSearchHandler from './api/bgg-search.js'

// `npm run dev` does not run Vercel serverless functions, so mount the
// BGG search handler on the dev server directly (production uses api/).
const devApiPlugin = {
  name: 'dev-api-bgg-search',
  configureServer(server) {
    server.middlewares.use('/api/bgg-search', (req, res) => {
      bggSearchHandler(req, res)
    })
  },
}

const pwaPlugin = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['apple-touch-icon.png'],
  manifest: {
    name: 'Board Game Scheduler',
    short_name: 'Game Nights',
    description:
      'Create a poll, share the link, and find the best date for your next board game night.',
    theme_color: '#c67139',
    background_color: '#f5ead8',
    display: 'standalone',
    start_url: '/',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    // Offline app shell: precached build assets plus an SPA fallback.
    // Poll data stays live-only (Firestore); /api/ is never routed to
    // the shell so BGG search fails cleanly instead of getting HTML.
    // woff2 is included so the identity fonts work offline (woff
    // fallbacks for ancient browsers are not worth caching).
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//],
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Expose BGG_API_TOKEN from .env to the dev API handler. It has no
  // VITE_ prefix, so it never reaches the client bundle.
  const env = loadEnv(mode, process.cwd(), 'BGG_')
  if (env.BGG_API_TOKEN) process.env.BGG_API_TOKEN = env.BGG_API_TOKEN

  return {
    plugins: [react(), devApiPlugin, pwaPlugin],
  }
})
