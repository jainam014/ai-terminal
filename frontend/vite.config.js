import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/propose': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/execute-approved': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/execute-approved-stream': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
      '/health': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
