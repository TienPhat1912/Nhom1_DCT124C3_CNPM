import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@contracts': path.resolve(import.meta.dirname, '../../packages/contracts/src'),
      '@i18n': path.resolve(import.meta.dirname, '../../packages/i18n/src'),
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5047',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5047',
        changeOrigin: true,
      }
    }
  }
});
