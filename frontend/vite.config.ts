import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Maintenance Tracker',
        short_name: 'Maintenance',
        theme_color: '#0f2742',
        background_color: '#f5f7fa',
        display: 'standalone',
        icons: [],
      },
      workbox: {
        navigateFallback: '/index.html',
      },
    }),
  ],
});
