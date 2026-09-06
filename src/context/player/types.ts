import type { RefObject } from 'react';
import type { QueueItem, TrackMeta } from '../../../types';

export type RepeatMode = 'off' | 'all' | 'one';
export type AutoMixPhase = 'idle' | 'analyzing-current' | 'analyzing-next' | 'mixing' | 'switching';
export type AutoMixColor = 'green' | 'orange' | 'red' | null;

export interface AutoMixBpm {
  current: number;
  next: number;
}

export interface PlayerContextValue {
  queue: QueueItem[];
  position: number;
  current: QueueItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffled: boolean;
  repeatMode: RepeatMode;
  artworkUrl: string | null;
  loadError: string | null;
  audioRef: RefObject<HTMLAudioElement | null>;
  justPlayed: QueueItem | null;
  playNow(tracks: TrackMeta[], startIndex?: number): void;
  enqueueNext(tracks: TrackMeta[]): void;
  enqueueEnd(tracks: TrackMeta[]): void;
  removeAt(index: number): void;
  removeAbove(index: number): void;
  removeBelow(index: number): void;
  move(from: number, to: number): void;
  jumpTo(index: number): void;
  next(): void;
  prev(): void;
  togglePlay(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  duckVolume(ducking: boolean): void;
  toggleShuffle(): void;
  jumbleQueue(): void;
  cycleRepeat(): void;
  clearQueue(): void;
  clearOthers(): void;
  getAnalyser(): AnalyserNode;
  autoMixEnabled: boolean;
  autoMixPhase: AutoMixPhase;
  autoMixColor: AutoMixColor;
  autoMixBpm: AutoMixBpm | null;
  autoMixProgress: number | null;
  toggleAutoMix(): void;
  sleepTimerRemaining: number;
  sleepTimerPaused: boolean;
  sleepTimerFinished: boolean;
  addSleepTimer(minutes: number): void;
  setSleepTimerMinutes(minutes: number): void;
  togglePauseSleepTimer(): void;
  cancelSleepTimer(): void;
  dismissSleepTimerFinished(): void;
  remoteLocked: boolean;
  setRemoteLocked(locked: boolean): void;
}

export const REMOTE_LOCK_MESSAGE = 'Playback disabled during remote controlling';
export const MAX_VOLUME = 1.5;
