import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useRemoteHost, type RemoteHost } from '../hooks/remote_host';
import { toast } from '../utils/toast';

const RemoteContext = createContext<RemoteHost | null>(null);

export const REMOTE_PATH = '/remote';

export function RemoteProvider({ children }: { children: ReactNode }) {
  const host = useRemoteHost();
  const announcedRef = useRef<string[]>([]);

  useEffect(() => {
    if (host.controllers.length === 0) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [host.controllers.length]);

  const phaseRef = useRef(host.phase);
  useEffect(() => {
    if (phaseRef.current !== 'error' && host.phase === 'error') {
      toast.error(host.error || 'The remote session ended');
      if (window.location.pathname !== REMOTE_PATH) host.stop();
    }
    phaseRef.current = host.phase;
  }, [host.phase, host.error, host.stop]);

  useEffect(() => {
    const known = announcedRef.current;
    for (const peer of host.pending) {
      if (known.includes(peer.id)) continue;
      known.push(peer.id);
      if (window.location.pathname !== REMOTE_PATH) {
        toast.info(`A ${peer.device} wants to control this device. Open Remote to approve it.`, 0);
      }
    }
    announcedRef.current = known.filter((id) => host.pending.some((peer) => peer.id === id));
  }, [host.pending]);

  return <RemoteContext.Provider value={host}>{children}</RemoteContext.Provider>;
}

export function useRemote(): RemoteHost {
  const ctx = useContext(RemoteContext);
  if (!ctx) throw new Error('useRemote must be used within RemoteProvider');
  return ctx;
}
