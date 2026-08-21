import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const CHUNK_RULES: [RegExp, string][] = [
  [/node_modules\/mespeak/, 'mespeak'],
  [/node_modules\/music-metadata/, 'music_metadata'],
  [/node_modules\/(react|react-dom|scheduler)\//, 'react_vendor'],
  [/node_modules\/(react-router|react-router-dom)\//, 'router_vendor'],
  [/node_modules/, 'vendor'],

  [/pages\/home/, 'page_home'],
  [/pages\/library/, 'page_library'],
  [/pages\/(artists|artist_detail)/, 'page_artists'],
  [/pages\/(albums|album_detail)/, 'page_albums'],
  [/pages\/queue/, 'page_queue'],
  [/pages\/(lyrics|share_lyrics)/, 'page_lyrics'],
  [/pages\/settings/, 'page_settings'],
  [/components\/scrobbling_settings/, 'page_settings'],
  [/pages\/(about|release_notes)/, 'page_about'],
  [/pages\/remote/, 'page_remote'],
  [/components\/remote_(host|control)/, 'page_remote'],
  [/hooks\/remote_control/, 'page_remote'],
  [/hooks\/(remote_host|remote_socket)/, 'context'],
  [/utils\/remote_protocol/, 'context'],

  [/components\/(fs_player|player_bar|scrubber|slider|equalizer|visualizer|auto_mix_drawer|queue_list|sleep_timer)/, 'ui_player'],
  [/components\/(modal|cover_modal|update_modal|scan_drawer|context_menu)/, 'ui_modals'],
  [/components\/(track_list|sort_select|skeletons|explicit_badge)/, 'ui_tracklist'],
  [/components\/lyrics/, 'ui_lyrics'],
  [/components\/(sidebar|icons|toast_container|spinner|scrolling_text)/, 'ui_shell'],

  [/hooks\/(media_session|keyboard_shortcuts|queue_finished_sound|track_notifications|wheel|electron_bridge|scrobbler)/, 'hooks_player'],
  [/hooks\/(infinite_scroll|scroll_restoration|page_title|drag_reorder|track_menu)/, 'hooks_ui'],
  [/hooks\/(album_art|explicit|scan_eta|speech_announcements|accent_color|lastfm_session|scrobble_status)/, 'hooks_data'],
  [/hooks\/ken_burns/, 'context'],

  [/context\//, 'context'],
  [/utils\/settings_transfer/, 'context'],

  [/management\/(db|scrobbles)/, 'management_db'],
  [/management\/(library|metadata|covers|scan_pool)/, 'management_library'],

  [/audio\/(bpm|eq)/, 'audio'],

  [/queue\/(history|reducer|shuffle)/, 'queue_state'],

  [/utils\/(format|groups|slug|ignore_rules)/, 'utils_format'],
  [/utils\/(speech|mespeak|pronunciation|profanity|explicit_tracks)/, 'utils_speech'],
  [/utils\/(accent_color|themes|toast|share_card|lyrics|electron|scrobble_rules|lastfm_session|scrobble_status)/, 'utils_misc'],

  [/api\//, 'api']
];

const scriptFileName = (name: string, prefix = '') =>
  `i/xebrine/scripts/${prefix}${name}_[hash].js`;

const chunkFileName = ({ name, moduleIds }: { name: string; moduleIds: string[] }) =>
  moduleIds.some((id) => id.includes('/node_modules/'))
    ? `i/xebrine/modules/xe_${name}_[hash].js`
    : scriptFileName(name, 'xe_');

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      manifestFilename: 'xebrine.webmanifest',
      registerType: 'prompt',
      includeAssets: [
        'i/xebrine/icon/xebrine_192_transparent.png',
        'i/xebrine/icon/xebrine_512_transparent.png'
      ],
      manifest: {
        name: 'Xebrine',
        id: 'com.exerinity.xebrine',
        short_name: 'Xebrine',
        description: 'Music Player',
        theme_color: '#4a29c2',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'i/xebrine/icon/xebrine_192_transparent.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'i/xebrine/icon/xebrine_512_transparent.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'i/xebrine/icon/xebrine_512_transparent.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        inlineWorkboxRuntime: true,
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
        hashCharacters: 'hex',
        entryFileNames: ({ name }) => scriptFileName(name),
        chunkFileNames: chunkFileName,
        assetFileNames(assetInfo) {
          const name = assetInfo.names?.[0] ?? '';
          if (name.endsWith('.css')) return 'i/xebrine/css/xebrine_[hash][extname]';
          const stem = name.replace(/\.[^./]+$/, '') || 'asset';
          return `assets/${stem}_[hash][extname]`;
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
        hashCharacters: 'hex',
        entryFileNames: ({ name }) => scriptFileName(name),
        chunkFileNames: chunkFileName
      }
    }
  }
});
