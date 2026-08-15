import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { loadEnv } from 'vite'

function cspPlugin(mode: string): PluginOption {
  return {
    name: 'converge-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
      const scriptHashes = inlineScripts.map((src) => {
        const digest = createHash('sha256').update(src).digest('base64')
        return `'sha256-${digest}'`
      })

      const env = loadEnv(mode, process.cwd(), '')
      const supabaseHost = env.VITE_SUPABASE_URL
        ? new URL(env.VITE_SUPABASE_URL).host
        : null

      const directives = [
        "default-src 'self'",
        `script-src 'self'${scriptHashes.length ? ` ${scriptHashes.join(' ')}` : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-src 'none'",
        "worker-src 'self' blob:",
        supabaseHost
          ? `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`
          : "connect-src 'self'",
      ]

      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: directives.join('; '),
            },
            injectTo: 'head-prepend',
          },
        ],
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    cspPlugin(mode),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Converge',
        short_name: 'Converge',
        display: 'standalone',
        start_url: '/',
        theme_color: '#fbfaf6',
        background_color: '#fbfaf6',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}))
