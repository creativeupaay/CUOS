import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          const match = id.split('node_modules/')[1];
          if (!match) return;

          const parts = match.split('/');
          const packageName = parts[0].startsWith('@')
            ? `${parts[0]}/${parts[1]}`
            : parts[0];

          return `vendor-${packageName.replace('@', '').replace('/', '-')}`;
        },
      },
    },
  },
})
