import { defineConfig } from 'vite'
import { resolve } from 'path'

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
  },
  resolve: {
    alias: {
      '/src': resolve(__dirname, 'src')
    }
  }
})
