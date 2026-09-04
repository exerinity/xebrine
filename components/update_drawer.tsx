import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshIcon } from './icons';
import { Spinner } from './spinner';

type UpdatePhase = 'available' | 'downloading' | 'reloading';

interface UpdateWorkerMessage {
  type?: string;
  message?: string;
}

export function UpdateDrawer() {
  const [phase, setPhase] = useState<UpdatePhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const applyTimerRef = useRef<number | null>(null);
  const reloadTimerRef = useRef<number | null>(null);
  const reloadFallbackRef = useRef<number | null>(null);

  const scheduleReload = () => {
    setPhase('reloading');
    if (reloadTimerRef.current !== null) return;
    reloadTimerRef.current = window.setTimeout(() => window.location.reload(), 500);
  };

  const {
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW({
    immediate: true,
    onNeedReload: scheduleReload,
    onRegisteredSW: (_url, registration) => {
      if (registration?.waiting) setPhase((current) => current ?? 'available');
    }
  });

  useEffect(() => {
    void navigator.serviceWorker?.getRegistration().then((registration) => {
      if (registration?.waiting) setPhase((current) => current ?? 'available');
    });
  }, []);

  useEffect(() => {
    const handleWorkerMessage = (event: MessageEvent<UpdateWorkerMessage>) => {
      if (event.data?.type === 'XEBRINE_UPDATE_DOWNLOADED') {
        setError(null);
        setPhase('reloading');
        applyTimerRef.current = window.setTimeout(() => {
          void updateServiceWorker().then(() => {
            reloadFallbackRef.current = window.setTimeout(() => window.location.reload(), 4_000);
          });
        }, 250);
      } else if (event.data?.type === 'XEBRINE_UPDATE_FAILED') {
        setError(event.data.message || 'The update could not be downloaded - try hard-refreshing');
        setPhase('available');
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleWorkerMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleWorkerMessage);
  }, [updateServiceWorker]);

  useEffect(
    () => () => {
      if (applyTimerRef.current !== null) window.clearTimeout(applyTimerRef.current);
      if (reloadTimerRef.current !== null) window.clearTimeout(reloadTimerRef.current);
      if (reloadFallbackRef.current !== null) window.clearTimeout(reloadFallbackRef.current);
    },
    []
  );

  const visiblePhase = phase ?? (needRefresh ? 'available' : null);
  const open = visiblePhase !== null;
  const downloading = visiblePhase === 'downloading';
  const reloading = visiblePhase === 'reloading';
  const title = reloading
    ? 'Xebrine is updating...'
    : downloading
      ? 'Downloading Xebrine update...'
      : 'New Xebrine update available';
  const description = reloading
    ? 'Reloading to apply...'
    : downloading
      ? 'Downloading update...'
      : error ?? 'Would you like to download it?';

  const download = async () => {
    setError(null);
    setPhase('downloading');
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.waiting) throw new Error('The waiting update could not be found...');
      registration.waiting.postMessage({ type: 'XEBRINE_DOWNLOAD_UPDATE' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The update could not be downloaded');
      setPhase('available');
    }
  };

  return (
    <div
      className={`xe_scan-drawer xe_update-drawer${open ? ' xe_scan-drawer--open' : ''}`}
      aria-live="polite"
      aria-hidden={!open}
    >
      <div className="xe_scan-drawer__head">
        {downloading || reloading ? <Spinner size={11} /> : <RefreshIcon size={12} />}
        <span className="xe_automix-drawer__title">{title}</span>
        {!downloading && !reloading && (
          <button type="button" className="xe_btn xe_btn--accent xe_btn--small" onClick={download}>
            Update
          </button>
        )}
      </div>
      {(downloading || reloading) && (
        <div className="xe_scan-drawer__bar xe_scan-drawer__bar--indeterminate">
          <div className="xe_scan-drawer__fill" />
        </div>
      )}
      <div className="xe_scan-drawer__meta">
        <span className="xe_scan-drawer__count">{description}</span>
      </div>
    </div>
  );
}
