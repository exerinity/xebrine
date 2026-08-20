import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const CHUNK_RULES: [RegExp, string][] = [
  [/node_modules\/mespeak/, 'mespeak'],
  [/node_modules\/music-metadata/, 'music-metadata'],
  [/node_modules\/(react|react-dom|scheduler)\//, 'react-vendor'],
  [/node_modules\/(react-router|react-router-dom)\//, 'router-vendor'],
  [/node_modules/, 'vendor'],

  [/pages\/home/, 'page-home'],
  [/pages\/library/, 'page-library'],
  [/pages\/(artists|artist_detail)/, 'page-artists'],
  [/pages\/(albums|album_detail)/, 'page-albums'],
  [/pages\/queue/, 'page-queue'],
  [/pages\/(lyrics|share_lyrics)/, 'page-lyrics'],
  [/pages\/settings/, 'page-settings'],
  [/components\/scrobbling_settings/, 'page-settings'],
  [/pages\/(about|release_notes)/, 'page-about'],
  [/pages\/remote/, 'page-remote'],
  [/components\/remote_(host|control)/, 'page-remote'],
  [/hooks\/remote_control/, 'page-remote'],
  [/hooks\/(remote_host|remote_socket)/, 'context'],
  [/utils\/remote_protocol/, 'context'],

  [/components\/(fs_player|player_bar|scrubber|slider|equalizer|visualizer|auto_mix_drawer|queue_list|sleep_timer)/, 'ui-player'],
  [/components\/(modal|cover_modal|update_modal|scan_drawer|context_menu)/, 'ui-modals'],
  [/components\/(track_list|sort_select|skeletons|explicit_badge)/, 'ui-tracklist'],
  [/components\/lyrics/, 'ui-lyrics'],
  [/components\/(sidebar|icons|toast_container|spinner|scrolling_text)/, 'ui-shell'],

  [/hooks\/(media_session|keyboard_shortcuts|queue_finished_sound|track_notifications|wheel|electron_bridge|scrobbler)/, 'hooks-player'],
  [/hooks\/(infinite_scroll|scroll_restoration|page_title|drag_reorder|track_menu)/, 'hooks-ui'],
  [/hooks\/(album_art|explicit|scan_eta|speech_announcements|accent_color|lastfm_session|scrobble_status)/, 'hooks-data'],
  [/hooks\/ken_burns/, 'context'],

  [/context\//, 'context'],
  [/utils\/settings_transfer/, 'context'],

  [/management\/(db|scrobbles)/, 'management-db'],
  [/management\/(library|metadata|covers|scan_pool)/, 'management-library'],

  [/audio\/(bpm|eq)/, 'audio'],

  [/queue\/(history|reducer|shuffle)/, 'queue-state'],

  [/utils\/(format|groups|slug|ignore_rules)/, 'utils-format'],
  [/utils\/(speech|mespeak|pronunciation|profanity|explicit_tracks)/, 'utils-speech'],
  [/utils\/(accent_color|themes|toast|share_card|lyrics|electron|scrobble_rules|lastfm_session|scrobble_status)/, 'utils-misc'],

  [/api\//, 'api']
];

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'app/media/icon-192-transparent.png',
        'app/media/icon-512-transparent.png'
      ],
      manifest: {
        name: 'Xebrine',
        id: 'com.exerinity.xebrine',
        short_name: 'Xebrine',
        description: 'Yet another music player PWA',
        theme_color: '#4a29c2',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'app/media/icon-192-transparent.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'app/media/icon-512-transparent.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'app/media/icon-512-transparent.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,woff2,json}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/i\/services\//],
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
  server: {
    proxy: {
      '/i/services': { target: 'http://127.0.0.1:8787', changeOrigin: false, ws: true }
    }
  },
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
          for (const [pattern, name] of CHUNK_RULES) {
            if (pattern.test(id)) return name;
          }
        }
      }
    }
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: 'app/scripts/[name]-[hash].js',
        chunkFileNames: 'app/scripts/[name]-[hash].js'
      }
    }
  }
});
