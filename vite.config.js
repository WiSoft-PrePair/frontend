import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { openaiTtsDevPlugin } from './vite-plugin-openai-tts-dev.js'

export default defineConfig({
  plugins: [
    {
      ...openaiTtsDevPlugin(),
      enforce: 'pre',
    },
    react(),
  ],
  server: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'https://prepair.wisoft.dev',
        changeOrigin: true,
        secure: false,
        bypass(req) {
          if (req.url?.startsWith('/api/tts')) {
            return false
          }
        },
      },
    },
  },
  preview: {
    allowedHosts: ['prepair.wisoft.dev'],
  },
})
