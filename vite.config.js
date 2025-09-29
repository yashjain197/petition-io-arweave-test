// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'stream', 'crypto', 'os', 'path'],
    }),
  ],
  define: {
    global: 'window', // some deps expect Node's global
  },
  optimizeDeps: {
    include: ['buffer'],
  },
});
