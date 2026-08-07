/** @typedef {'play' | 'pause' | 'playpause' | 'stop' | 'next' | 'previous' | 'seek' | 'volume' | 'shuffle' | 'loop'} ElectronControl */

/** @typedef {'None' | 'Track' | 'Playlist'} ElectronLoop */

/** @typedef {'playing' | 'paused' | 'stopped'} ElectronStatus */

/**
 * @typedef {Object} ElectronPlaybackState
 * @property {string | null} trackId
 * @property {string} title
 * @property {string} artist
 * @property {string} album
 * @property {ElectronStatus} status
 * @property {number} durationSeconds
 * @property {number} currentSeconds
 * @property {number} volume
 * @property {boolean} shuffle
 * @property {ElectronLoop} loop
 * @property {boolean} canGoNext
 * @property {boolean} canGoPrevious
 */

/**
 * @typedef {Object} ElectronBridge
 * @property {string} platform
 * @property {{ electron: string, chrome: string }} versions
 * @property {(state: ElectronPlaybackState) => void} updateState
 * @property {(trackId: string | null, dataUrl: string | null) => void} setArtwork
 * @property {(handler: (control: ElectronControl, payload?: number | boolean | string) => void) => void} onControl
 * @property {() => void} offControl
 */

function resolveBridge() {
  if (typeof window === 'undefined') return null;
  const bridge = window.xebrineShell;
  return bridge && typeof bridge.updateState === 'function' ? bridge : null;
}

/** @type {ElectronBridge | null} */
export const electron = resolveBridge();

export const isElectron = electron !== null;

export function electronVersion() {
  return electron?.versions.electron ?? null;
}
