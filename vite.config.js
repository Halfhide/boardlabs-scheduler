/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
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

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Expose BGG_API_TOKEN from .env to the dev API handler. It has no
  // VITE_ prefix, so it never reaches the client bundle.
  const env = loadEnv(mode, process.cwd(), 'BGG_')
  if (env.BGG_API_TOKEN) process.env.BGG_API_TOKEN = env.BGG_API_TOKEN

  return {
    plugins: [react(), devApiPlugin],
  }
})
