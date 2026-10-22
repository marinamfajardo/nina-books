/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// O app é publicado em https://marinamfajardo.github.io/nina-books/
export default defineConfig({
  base: '/nina-books/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: "Nina Book's",
        short_name: "Nina Book's",
        description: 'Sua biblioteca pessoal de leituras',
        lang: 'pt-BR',
        theme_color: '#6d1a36',
        background_color: '#fff7f8',
        display: 'standalone',
        orientation: 'any',
        start_url: '/nina-books/',
        scope: '/nina-books/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // service worker próprio (src/sw.ts): offline + notificações diárias
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
