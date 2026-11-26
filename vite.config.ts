import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// PWA: a single-page reader app. No router dependency needed.
export default defineConfig(({ mode }) => ({
  base: mode === 'github-pages' ? '/ReadText/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
  },
}))
