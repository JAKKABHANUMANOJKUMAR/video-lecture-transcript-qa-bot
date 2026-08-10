import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ingest': {
        target: 'http://127.0.0.1:8100',
        changeOrigin: true,
        secure: false,
      },
      '/query': {
        target: 'http://127.0.0.1:8100',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://127.0.0.1:8100',
        changeOrigin: true,
        secure: false,
      },
      '/viewer': {
        target: 'http://127.0.0.1:8100',
        changeOrigin: true,
        secure: false,
      },
      '/api/chroma': {
        target: 'http://127.0.0.1:8100',
        changeOrigin: true,
        secure: false,
      },
      '/rag': {
        target: 'http://127.0.0.1:8100',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
