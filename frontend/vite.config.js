import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  return {
    plugins: [react()],
    envDir: './',
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
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
