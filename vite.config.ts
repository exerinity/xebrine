import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const chunk_rules: [RegExp, string][] = [
  [/node_modules\/mespeak\//, 'msp'],
  [/node_modules\/mediainfo\.js\//, 'minf'],
  [/node_modules\/music-metadata\//, 'mmd'],
  [/node_modules\/react\//, 'rct'],
  [/node_modules\/react-dom\//, 'rdm'],
  [/node_modules\/scheduler\//, 'sch'],
  [/node_modules\/react-router\//, 'rtr'],
  [/node_modules\/(?!(?:cookie|set-cookie-parser|react-router-dom)\/)((?:@[^/]+\/)?[^/]+)\//, 'vendor'],

  [/pages\/home\.[^/?]+(?:\?|$)/, 'hom'],
  [/pages\/library\.[^/?]+(?:\?|$)/, 'lib'],
  [/pages\/artists\.[^/?]+(?:\?|$)/, 'arts'],
  [/pages\/artist_detail\.[^/?]+(?:\?|$)/, 'artd'],
  [/pages\/albums\.[^/?]+(?:\?|$)/, 'albs'],
  [/pages\/album_detail\.[^/?]+(?:\?|$)/, 'albd'],
  [/pages\/queue\.[^/?]+(?:\?|$)/, 'que'],
  [/pages\/lyrics\.[^/?]+(?:\?|$)/, 'lyrp'],
  [/pages\/share_lyrics\.[^/?]+(?:\?|$)/, 'lyrs'],
  [/pages\/settings\.[^/?]+(?:\?|$)/, 'set'],
  [/components\/scrobbling_settings\.[^/?]+(?:\?|$)/, 'scset'],
  [/pages\/about\.[^/?]+(?:\?|$)/, 'abt'],
  [/pages\/release_notes\.[^/?]+(?:\?|$)/, 'rel'],
  [/pages\/remote\.[^/?]+(?:\?|$)/, 'rem'],
  [/components\/remote_host\.[^/?]+(?:\?|$)/, 'rmh'],
  [/components\/remote_control\.[^/?]+(?:\?|$)/, 'rmc'],
  [/hooks\/remote_control\.[^/?]+(?:\?|$)/, 'hrmc'],
  [/hooks\/remote_host\.[^/?]+(?:\?|$)/, 'hrmh'],
  [/hooks\/remote_socket\.[^/?]+(?:\?|$)/, 'rms'],
  [/utils\/remote_protocol\.[^/?]+(?:\?|$)/, 'rmp'],

  [/components\/fs_player\.[^/?]+(?:\?|$)/, 'fsp'],
  [/components\/player_bar\.[^/?]+(?:\?|$)/, 'plb'],
  [/components\/scrubber\.[^/?]+(?:\?|$)/, 'scr'],
  [/components\/slider\.[^/?]+(?:\?|$)/, 'sld'],
  [/components\/equalizer\.[^/?]+(?:\?|$)/, 'eql'],
  [/components\/visualizer\.[^/?]+(?:\?|$)/, 'vis'],
  [/components\/auto_mix_drawer\.[^/?]+(?:\?|$)/, 'amd'],
  [/components\/queue_list\.[^/?]+(?:\?|$)/, 'qls'],
  [/components\/sleep_timer\.[^/?]+(?:\?|$)/, 'slp'],
  [/components\/modal\.[^/?]+(?:\?|$)/, 'mdl'],
  [/components\/cover_modal\.[^/?]+(?:\?|$)/, 'cvm'],
  [/components\/update_drawer\.[^/?]+(?:\?|$)/, 'upd'],
  [/components\/scan_drawer\.[^/?]+(?:\?|$)/, 'scn'],
  [/components\/context_menu\.[^/?]+(?:\?|$)/, 'ctxm'],
  [/components\/track_list\.[^/?]+(?:\?|$)/, 'tls'],
  [/components\/sort_select\.[^/?]+(?:\?|$)/, 'srt'],
  [/components\/skeletons\.[^/?]+(?:\?|$)/, 'skl'],
  [/components\/explicit_badge\.[^/?]+(?:\?|$)/, 'exb'],
  [/components\/lyrics\.[^/?]+(?:\?|$)/, 'lyr'],
  [/components\/lrclib_search_modal\.[^/?]+(?:\?|$)/, 'lrs'],
  [/components\/sidebar\.[^/?]+(?:\?|$)/, 'sdb'],
  [/components\/icons\.[^/?]+(?:\?|$)/, 'ico'],
  [/components\/toast_container\.[^/?]+(?:\?|$)/, 'tstc'],
  [/components\/spinner\.[^/?]+(?:\?|$)/, 'spn'],
  [/components\/scrolling_text\.[^/?]+(?:\?|$)/, 'sctx'],

  [/hooks\/media_session\.[^/?]+(?:\?|$)/, 'mds'],
  [/hooks\/keyboard_shortcuts\.[^/?]+(?:\?|$)/, 'key'],
  [/hooks\/queue_finished_sound\.[^/?]+(?:\?|$)/, 'qfs'],
  [/hooks\/track_notifications\.[^/?]+(?:\?|$)/, 'tnf'],
  [/hooks\/wheel\.[^/?]+(?:\?|$)/, 'whl'],
  [/hooks\/electron_bridge\.[^/?]+(?:\?|$)/, 'elb'],
  [/hooks\/scrobbler\.[^/?]+(?:\?|$)/, 'scb'],
  [/hooks\/infinite_scroll\.[^/?]+(?:\?|$)/, 'infs'],
  [/hooks\/scroll_restoration\.[^/?]+(?:\?|$)/, 'scres'],
  [/hooks\/page_title\.[^/?]+(?:\?|$)/, 'ptl'],
  [/hooks\/drag_reorder\.[^/?]+(?:\?|$)/, 'dgr'],
  [/hooks\/track_menu\.[^/?]+(?:\?|$)/, 'tmn'],
  [/hooks\/album_art\.[^/?]+(?:\?|$)/, 'aar'],
  [/hooks\/explicit\.[^/?]+(?:\?|$)/, 'hex'],
  [/hooks\/scan_eta\.[^/?]+(?:\?|$)/, 'eta'],
  [/hooks\/speech_announcements\.[^/?]+(?:\?|$)/, 'spa'],
  [/hooks\/accent_color\.[^/?]+(?:\?|$)/, 'hac'],
  [/hooks\/lastfm_session\.[^/?]+(?:\?|$)/, 'hlfs'],
  [/hooks\/scrobble_status\.[^/?]+(?:\?|$)/, 'hscs'],
  [/hooks\/ken_burns\.[^/?]+(?:\?|$)/, 'ken'],

  [/context\/([^?]+?)\.[^/.?]+(?:\?|$)/, 'context'],
  [/utils\/settings_transfer\.[^/?]+(?:\?|$)/, 'setr'],

  [/management\/db\.[^/?]+(?:\?|$)/, 'db'],
  [/management\/scrobbles\.[^/?]+(?:\?|$)/, 'scdb'],
  [/management\/library\.[^/?]+(?:\?|$)/, 'mlib'],
  [/management\/metadata\.[^/?]+(?:\?|$)/, 'meta'],
  [/management\/covers\.[^/?]+(?:\?|$)/, 'cov'],
  [/management\/scan_pool\.[^/?]+(?:\?|$)/, 'scp'],

  [/audio\/track_analysis\.[^/?]+(?:\?|$)/, 'tan'],
  [/audio\/crossfade\.[^/?]+(?:\?|$)/, 'xfd'],
  [/audio\/eq_constants\.[^/?]+(?:\?|$)/, 'eqc'],
  [/audio\/eq_normalization\.[^/?]+(?:\?|$)/, 'eqn'],
  [/audio\/eq_response\.[^/?]+(?:\?|$)/, 'eqr'],
  [/audio\/eq_format\.[^/?]+(?:\?|$)/, 'eqf'],

  [/queue\/history\.[^/?]+(?:\?|$)/, 'qhs'],
  [/queue\/reducer\.[^/?]+(?:\?|$)/, 'qrd'],
  [/queue\/shuffle\.[^/?]+(?:\?|$)/, 'qsh'],

  [/utils\/format\.[^/?]+(?:\?|$)/, 'fmt'],
  [/utils\/groups\.[^/?]+(?:\?|$)/, 'grp'],
  [/utils\/slug\.[^/?]+(?:\?|$)/, 'slg'],
  [/utils\/ignore_rules\.[^/?]+(?:\?|$)/, 'ign'],
  [/utils\/speech\.[^/?]+(?:\?|$)/, 'spch'],
  [/utils\/mespeak\.[^/?]+(?:\?|$)/, 'umsp'],
  [/utils\/pronunciation\.[^/?]+(?:\?|$)/, 'prn'],
  [/utils\/profanity\.[^/?]+(?:\?|$)/, 'prf'],
  [/utils\/explicit_tracks\.[^/?]+(?:\?|$)/, 'ext'],
  [/utils\/accent_color\.[^/?]+(?:\?|$)/, 'acc'],
  [/utils\/themes\.[^/?]+(?:\?|$)/, 'thm'],
  [/utils\/toast\.[^/?]+(?:\?|$)/, 'tst'],
  [/utils\/share_card\.[^/?]+(?:\?|$)/, 'shc'],
  [/utils\/lyrics\.[^/?]+(?:\?|$)/, 'ulyr'],
  [/utils\/electron\.[^/?]+(?:\?|$)/, 'ele'],
  [/utils\/scrobble_rules\.[^/?]+(?:\?|$)/, 'scrl'],
  [/utils\/lastfm_session\.[^/?]+(?:\?|$)/, 'lfs'],
  [/utils\/scrobble_status\.[^/?]+(?:\?|$)/, 'scs'],

  [/api\/([^?]+?)\.[^/.?]+(?:\?|$)/, 'api']
];

const chunk_aliases: Record<string, string> = {
  _commonjsHelpers: 'cjs',
  'preload-helper': 'pre',
  keyboard: 'kbd',
  stored_lyrics: 'slyr',
  radio_station: 'rst',
  logo: 'lgo',
  scan_status_banner: 'scbn',
  drawer_presence: 'drp',
  count_up: 'cnt',
  floating_input: 'fin',
  cover_image: 'cvi',
  beat_grid: 'btg',
  react: 'rjsx',
  fs_minimal: 'fsm',
  deep_search: 'dps',
  auto_play: 'apl',
  vendor_media_typer: 'mtp',
  vendor_uint8array_extras: 'u8x',
  vendor_ieee754: 'ieee',
  vendor_win_guid: 'guid',
  vendor_ms: 'ms',
  vendor_content_type: 'ctyp',
  vendor_token_types: 'tok',
  vendor__borewit_text_codec: 'txtc',
  vendor_debug: 'dbg',
  vendor_workbox_window: 'wbx',
  vendor__tokenizer_inflate: 'infl',
  vendor_strtok3: 'stk',
  vendor_file_type: 'ftyp',
  context_player_context: 'cpl',
  context_setup_flow_context: 'csu',
  context_settings_context: 'cset',
  context_remote_context: 'crm',
  context_library_context: 'clib',
  context_player_sleep_timer: 'pslp',
  context_player_radio_artwork: 'rart',
  context_player_radio_playback: 'rply',
  context_player_auto_mix: 'amx',
  context_player_audio_graph: 'agr',
  context_player_storage: 'pst',
  context_player_types: 'pty',
  context_player_index: 'pix',
  context_player_player_context: 'pctx',
  api_lastfm: 'lfm',
  api_radio_browser: 'rad',
  api_lrclib: 'lrc'
};

const scriptFileName = (name: string, prefix = '') =>
  `i/xebrine/scripts/${prefix}${name}_[hash].js`;

const chunkFileName = ({ name, moduleIds }: { name: string; moduleIds: string[] }) => {
  const chunk_name = chunk_aliases[name] ?? name;
  return moduleIds.some((id) => id.includes('/node_modules/'))
    ? `i/xebrine/modules/xe_${chunk_name}_[hash].js`
    : scriptFileName(chunk_name, 'xe_');
};

export default defineConfig(({ mode }) => ({
  define: {
    __XEBRINE_BUILD_ID__: JSON.stringify(mode === 'stage' ? `stage-${Date.now()}` : 'production')
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: '.',
      filename: 'sw.ts',
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
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,woff2,json,wasm}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        manifestTransforms: [
          async (entries) => ({
            manifest: entries.map((entry) =>
              entry.url === 'index.html' ? { ...entry, url: '/' } : entry
            ),
            warnings: []
          })
        ],
        rollupFormat: 'iife'
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
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          for (const [pattern, name] of chunk_rules) {
            const match = id.match(pattern);
            if (match) {
              const chunk_name = match[1] ? `${name}_${match[1].replace(/[^a-zA-Z0-9_]/g, '_')}` : name;
              return chunk_aliases[chunk_name] ?? chunk_name;
            }
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
}));
