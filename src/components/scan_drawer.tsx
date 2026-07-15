import { useEffect, useState } from 'react';
import { useLibrary } from '../context/library_context';
import { formatEta, formatRate, useScanStats } from '../hooks/scan_eta';
import { Spinner } from './spinner';

export function ScanDrawer() {
  const { scanning, stopScan } = useLibrary();
  const { eta, rate } = useScanStats(scanning);
  const [shown, setShown] = useState(scanning);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (scanning) setShown(scanning);
    else setStopping(false);
  }, [scanning]);

  const handleStop = () => {
    setStopping(true);
    stopScan();
  };

  const open = scanning !== null;
  const info = scanning ?? shown;
  const indeterminate = !info || info.total <= 0;
  const percent = indeterminate ? 0 : Math.round((info!.done / info!.total) * 100);

  return (
    <div className={`xe_scan-drawer${open ? ' xe_scan-drawer--open' : ''}`} aria-hidden={!open}>
      <div className="xe_scan-drawer__head">
        <Spinner size={11} />
        <span className="xe_scan-drawer__title">
          Scanning <strong>{info?.folderName ?? ''}</strong>
        </span>
        <button
          type="button"
          className="xe_scan-drawer__stop"
          onClick={handleStop}
          disabled={stopping}
          title="Stop scanning here"
          aria-label="Stop scanning here"
        >
          {stopping ? 'Stopping...' : 'Stop'}
        </button>
      </div>
      <div className={`xe_scan-drawer__bar${indeterminate ? ' xe_scan-drawer__bar--indeterminate' : ''}`}>
        <div className="xe_scan-drawer__fill" style={indeterminate ? undefined : { width: `${percent}%` }} />
      </div>
      <div className="xe_scan-drawer__meta">
        <span className="xe_scan-drawer__count">
          {indeterminate
            ? 'Initializing...'
            : `${info!.done} / ${info!.total} files${info!.omitted > 0 ? ` - ${info!.omitted} omitted` : ''}`}
          {rate !== null && !indeterminate && ` - ${formatRate(rate)} files a second`}
        </span>
        {eta !== null && <span className="xe_scan-drawer__eta">{formatEta(eta)}</span>}
      </div>
    </div>
  );
}
