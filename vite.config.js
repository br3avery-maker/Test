import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  root: 'public',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 3000,
    host: true
  },
  preview: {
    port: 4000
  }
})
