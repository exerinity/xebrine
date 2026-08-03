import { useEffect, useRef } from 'react';
import { usePlayer } from '../context/player_context';
import { useSettings } from '../context/settings_context';
import { useLastfmSession } from './lastfm_session';
import { sendNowPlaying, type ScrobbleEntry } from '../api/lastfm';
import { flushScrobbles, queueScrobble } from '../management/scrobbles';
import {
  buildScrobblePayload,
  isScrobbleLength,
  scrobbleThreshold,
  shouldIgnoreScrobble
} from '../utils/scrobble_rules';
import { toast } from '../utils/toast';
import { setScrobbleStatus } from '../utils/scrobble_status';

interface PlayState {
  startedAt: number;
  nowPlayingSent: boolean;
  scrobbled: boolean;
}

const RESTART_WINDOW = 1;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

async function submit(sessionKey: string, entry: ScrobbleEntry): Promise<void> {
  setScrobbleStatus('sending');
  await queueScrobble(entry);
  if (!navigator.onLine) {
    setScrobbleStatus('failed');
    return;
  }
  try {
    await flushScrobbles(sessionKey);
    setScrobbleStatus('scrobbled');
  } catch (error) {
    setScrobbleStatus('failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    toast.error(`Couldn't scrobble "${entry.track}" to Last.fm: ${message}`, 0);
  }
}

export function useScrobbler(): void {
  const { current, isPlaying, currentTime, duration } = usePlayer();
  const { settings } = useSettings();
  const session = useLastfmSession();

  const stateRef = useRef<PlayState | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const key = current?.key ?? null;
  const track = current?.track ?? null;
  const sessionKey = session?.sessionKey ?? null;

  useEffect(() => {
    const flush = () => {
      const sk = sessionRef.current?.sessionKey;
      if (!sk || !navigator.onLine) return;
      flushScrobbles(sk).catch(() => null);
    };
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [sessionKey]);

  useEffect(() => {
    stateRef.current = key ? { startedAt: nowSeconds(), nowPlayingSent: false, scrobbled: false } : null;
  }, [key]);

  useEffect(() => {
    if (!settings.scrobbleEnabled) {
      setScrobbleStatus('off');
      return;
    }
    if (!sessionKey) {
      setScrobbleStatus('ready');
      return;
    }
    if (stateRef.current?.scrobbled) return;
    setScrobbleStatus(key && isPlaying ? 'tracking' : 'ready');
  }, [key, isPlaying, sessionKey, settings.scrobbleEnabled]);

  useEffect(() => {
    const state = stateRef.current;
    const config = settingsRef.current;
    const sk = sessionRef.current?.sessionKey;
    if (!state || !track || !sk || !isPlaying) return;
    if (!config.scrobbleEnabled || !config.scrobbleNowPlaying) return;
    if (state.nowPlayingSent) return;
    if (shouldIgnoreScrobble(track, config.scrobbleIgnoreRules)) return;
    const payload = buildScrobblePayload(track, config.scrobbleMode);
    if (!payload) return;
    state.nowPlayingSent = true;
    sendNowPlaying(sk, payload).catch(() => null);
  }, [key, isPlaying, sessionKey]);

  useEffect(() => {
    const state = stateRef.current;
    const config = settingsRef.current;
    const sk = sessionRef.current?.sessionKey;
    if (!state || !track) return;

    if (state.scrobbled) {
      if (currentTime < RESTART_WINDOW) {
        state.scrobbled = false;
        state.nowPlayingSent = false;
        state.startedAt = nowSeconds();
      }
      return;
    }

    if (!sk || !config.scrobbleEnabled) return;
    if (!isScrobbleLength(duration)) return;
    if (currentTime < scrobbleThreshold(duration)) return;
    if (shouldIgnoreScrobble(track, config.scrobbleIgnoreRules)) return;
    const payload = buildScrobblePayload(track, config.scrobbleMode);
    if (!payload) return;

    state.scrobbled = true;
    void submit(sk, { ...payload, timestamp: state.startedAt });
  }, [currentTime, duration, key, sessionKey]);
}
