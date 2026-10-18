import { useEffect, useRef } from 'react';
import { usePlayer } from '../src/context/player';
import { useSettings } from '../context/settings_context';
import { useLastfmSession } from './lastfm_session';
import { sendNowPlaying, type ScrobbleEntry } from '../api/lastfm';
import { flushScrobbles, pendingScrobbles, queueScrobble } from '../management/scrobbles';
import {
  buildScrobblePayload,
  isScrobbleLength,
  scrobbleThreshold,
  shouldIgnoreScrobble
} from '../utils/scrobble_rules';
import { toast } from '../utils/toast';
import { setScrobbleStatus } from '../utils/scrobble_status';
import { is_online, use_online } from './online_status';

interface PlayState {
  startedAt: number;
  nowPlayingSent: boolean;
  scrobbled: boolean;
}

const RESTART_WINDOW = 1;
const NOW_PLAYING_DELAY_MS = 2000;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function is_transient_error(error: unknown): boolean {
  const status = error && typeof error === 'object' && 'status' in error ? error.status : 0;
  return !is_online() || error instanceof TypeError || status === 429 || (typeof status === 'number' && status >= 500);
}

async function submit(sessionKey: string, entry: ScrobbleEntry): Promise<void> {
  await queueScrobble(entry);
  if (!is_online()) {
    setScrobbleStatus('queued');
    return;
  }
  setScrobbleStatus('sending');
  try {
    await flushScrobbles(sessionKey);
    const remaining = await pendingScrobbles();
    const id = `${entry.timestamp}-${entry.artist}-${entry.track}`;
    setScrobbleStatus(remaining.some((item) => item.id === id) ? 'queued' : 'scrobbled');
  } catch (error) {
    const transient = is_transient_error(error);
    setScrobbleStatus(transient ? 'queued' : 'failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (!transient) toast.error(`Couldn't scrobble "${entry.track}" to Last.fm: ${message}`, 0);
  }
}

export function useScrobbler(): void {
  const { current, isPlaying, currentTime, duration } = usePlayer();
  const { settings } = useSettings();
  const session = useLastfmSession();
  const online = use_online();

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
      if (!sk || !is_online()) return;
      flushScrobbles(sk).then((sent) => {
        if (sent > 0) setScrobbleStatus('scrobbled');
      }).catch((error: unknown) => setScrobbleStatus(is_transient_error(error) ? 'queued' : 'failed'));
    };
    flush();
  }, [sessionKey, online]);

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
    const timer = window.setTimeout(() => {
      if (!is_online()) return;
      state.nowPlayingSent = true;
      sendNowPlaying(sk, payload).catch(() => { state.nowPlayingSent = false; });
    }, NOW_PLAYING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [key, isPlaying, sessionKey, online]);

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
