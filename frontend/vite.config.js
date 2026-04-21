import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo.png', 'images/Bireena atithi.png'],
        workbox: {
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
        },
        manifest: {
          name: 'Bireena Atithi',
          short_name: 'Bireena',
          description: 'Bireena Atithi hotel management app',
          theme_color: '#d90416',
          background_color: '#d90416',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: '/images/Bireena atithi.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: '/images/Bireena atithi.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    envDir: './',
    server: {
      port: 3000,
      host: '0.0.0.0', // Important for Codespaces to map network properly
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:5000', // Use IPv4 specifically to prevent 502/500 proxy ECONNREFUSED issues in Node 18+
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      sourcemap: false,
      minify: 'terser',
      cssMinify: true,
      reportCompressedSize: false,
      target: 'es2019',
      terserOptions: isProduction
        ? {
            compress: {
              drop_console: true,
              drop_debugger: true,
              dead_code: true,
              passes: 2,
            },
            mangle: {
              toplevel: true,
            },
            format: {
              comments: false,
            },
          }
        : undefined,
    },
    esbuild: isProduction
      ? {
          legalComments: 'none',
        }
      : undefined,
  }
})
