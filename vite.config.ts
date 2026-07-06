import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app/media/icon-192.png', 'app/media/icon-512.png'],
      manifest: {
        name: 'Xebrine',
        id: 'com.exerinity.xebrine',
        short_name: 'Xebrine',
        description: 'Xebrine is the library-focused spiritual successor to Voxity',
        theme_color: '#4a29c2',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'app/media/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'app/media/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'app/media/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,woff2}'],
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/lrclib\.net\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'lrclib',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'app/scripts/[name]-[hash].js',
        chunkFileNames: 'app/scripts/xe_[name]-[hash].js',
        assetFileNames(assetInfo) {
          const name = assetInfo.names?.[0] ?? '';
          if (name.endsWith('.css')) return 'app/stylesheets/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        },
        manualChunks(id) {
          if (id.includes('node_modules')) return 'node_modules';
          if (id.match(/pages\/library/)) return 'library';
          if (id.match(/pages\/(artists|artist_detail)/)) return 'artists';
          if (id.match(/pages\/(albums|album_detail)/)) return 'albums';
          if (id.match(/pages\/queue/)) return 'queue';
          if (id.match(/pages\/lyrics/)) return 'lyrics';
          if (id.match(/pages\/settings/)) return 'settings';
          if (id.match(/context\//)) return 'context';
        }
      }
    }
  },
  worker: {
    rollupOptions: {
      output: {
        entryFileNames: 'app/scripts/[name]-[hash].js',
        chunkFileNames: 'app/scripts/[name]-[hash].js'
      }
    }
  }
});
