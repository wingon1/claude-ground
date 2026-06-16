import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Served from https://<user>.github.io/claude-ground/ on GitHub Pages,
// so assets must resolve under the repo subpath.
export default defineConfig({
  base: '/claude-ground/',
  plugins: [react(), tailwindcss()],
})
