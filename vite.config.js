import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isGithubPages = process.env.GITHUB_PAGES === "true"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: isGithubPages ? '/SuggestONC-Pro/' : '/',
  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      '.ngrok-free.app'
    ]
  }
})


