import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.HERMES_API_TARGET || 'http://127.0.0.1:8642'
  const apiKey = env.HERMES_API_KEY || ''

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/hermes-api': {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/hermes-api/, ''),
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        },
      },
    },
  }
})
