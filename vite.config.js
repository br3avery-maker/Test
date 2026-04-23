import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: '/workspace/8debbf20-054b-4b05-826e-378ce3c23de4/sessions/agent_579b0863-7171-4028-b4f3-08c2516b6961/public/index.html'
    }
  },
  server: {
    port: 3000,
    host: true
  },
  preview: {
    port: 4000
  }
})
