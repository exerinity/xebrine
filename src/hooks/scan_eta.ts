import { useEffect, useRef, useState } from 'react';

interface ScanLike {
  done: number;
  total: number;
}

export function useScanEta(scanning: ScanLike | null): number | null {
  const samplesRef = useRef<{ t: number; done: number }[]>([]);
  const [eta, setEta] = useState<number | null>(null);

  useEffect(() => {
    if (!scanning || scanning.total <= 0) {
      samplesRef.current = [];
      setEta(null);
      return;
    }

    const now = performance.now();
    const samples = samplesRef.current;
    if (samples.length && scanning.done < samples[samples.length - 1].done) {
      samples.length = 0;
    }
    samples.push({ t: now, done: scanning.done });

    const WINDOW_MS = 10000;
    while (samples.length > 2 && now - samples[0].t > WINDOW_MS) samples.shift();

    const first = samples[0];
    const last = samples[samples.length - 1];
    const dDone = last.done - first.done;
    const dSeconds = (last.t - first.t) / 1000;

    if (dSeconds >= 0.5 && dDone > 0) {
      const rate = dDone / dSeconds;
      const remaining = scanning.total - scanning.done;
      setEta(remaining > 0 ? remaining / rate : 0);
    }
  }, [scanning]);

  return eta;
}

export function formatEta(seconds: number): string {
  if (seconds < 1) return 'almost done';
  const total = Math.ceil(seconds);
  if (total < 60) return `about ${total}s left`;
  const mins = Math.floor(total / 60);
  const rem = total % 60;
  return rem ? `about ${mins}m ${rem}s left` : `about ${mins}m left`;
}
