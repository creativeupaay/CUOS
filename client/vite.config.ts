import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import { compression } from 'vite-plugin-compression2'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), compression()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Raise the chunk-size warning threshold slightly — we are intentionally
    // grouping packages so a few chunks will be larger than Vite's 500 KB default.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Group related packages into logical chunks instead of one file per package.
        // Old approach produced ~60 JS files; this produces ~12, reducing HTTP waterfall
        // on cold loads from ~60 requests to ~12.
        manualChunks: {
          // React runtime — rarely changes, cache indefinitely
          'react-core': ['react', 'react-dom', 'react-router-dom'],
          // State management
          'redux': ['@reduxjs/toolkit', 'react-redux'],
          // Charting library (large, rarely changes)
          'ui-charts': ['recharts'],
          // Drag-and-drop (used in project tasks, kanban)
          'ui-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          // Rich text editor
          'ui-editor': [
            '@tiptap/react',
            '@tiptap/starter-kit',
            '@tiptap/extension-placeholder',
          ],
          // Form libraries
          'ui-forms': [
            'react-hook-form',
            '@hookform/resolvers',
            'zod',
            'react-select',
            'react-currency-input-field',
          ],
          // PDF generation — very heavy (~1.4 MB), isolated so non-PDF users never download it
          'pdf': ['@react-pdf/renderer'],
          // General utilities
          'utils': [
            'date-fns',
            'lodash.debounce',
            'lucide-react',
            'clsx',
            'tailwind-merge',
            'async-mutex',
            'react-hot-toast',
          ],
          // Real-time socket
          'socket': ['socket.io-client'],
          // Markdown rendering
          'markdown': ['react-markdown'],
        },
      },
    },
  },
})
