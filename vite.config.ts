import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' => deployable to any free static host (GitHub Pages / Netlify / Vercel)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
})
