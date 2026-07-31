export type ElectronControl =
  | 'play'
  | 'pause'
  | 'playpause'
  | 'stop'
  | 'next'
  | 'previous'
  | 'seek'
  | 'volume'
  | 'shuffle'
  | 'loop';

export type ElectronLoop = 'None' | 'Track' | 'Playlist';

export type ElectronStatus = 'playing' | 'paused' | 'stopped';

export interface ElectronPlaybackState {
  trackId: string | null;
  title: string;
  artist: string;
  album: string;
  status: ElectronStatus;
  durationSeconds: number;
  currentSeconds: number;
  volume: number;
  shuffle: boolean;
  loop: ElectronLoop;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

export interface ElectronBridge {
  platform: string;
  versions: { electron: string; chrome: string };
  updateState(state: ElectronPlaybackState): void;
  setArtwork(trackId: string | null, dataUrl: string | null): void;
  onControl(handler: (control: ElectronControl, payload?: number | boolean | string) => void): void;
  offControl(): void;
}

declare global {
  interface Window {
    xebrineShell?: ElectronBridge;
  }
}

function resolveBridge(): ElectronBridge | null {
  if (typeof window === 'undefined') return null;
  const bridge = window.xebrineShell;
  return bridge && typeof bridge.updateState === 'function' ? bridge : null;
}

export const electron: ElectronBridge | null = resolveBridge();

export const isElectron = electron !== null;

export function electronVersion(): string | null {
  return electron?.versions.electron ?? null;
}
