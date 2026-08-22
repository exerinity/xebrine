import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLibrary } from '../context/library_context';
import { formatEta, formatRate, useScanStats } from '../hooks/scan_eta';
import { formatDurationShort } from '../utils/format';
import { CheckIcon } from './icons';
import { Modal } from './modal';
import { Spinner } from './spinner';

export function ScanDrawer() {
  const { scanning, scanReport, stopScan, dismissScanReport } = useLibrary();
  const { eta, rate } = useScanStats(scanning);
  const [shown, setShown] = useState(scanning);
  const [shownReport, setShownReport] = useState(scanReport);
  const [stopping, setStopping] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [fileNameOnly, setFileNameOnly] = useState(false);
  const fileLineRef = useRef<HTMLDivElement>(null);
  const fullPathRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (scanning) setShown(scanning);
    else setStopping(false);
  }, [scanning]);

  useEffect(() => {
    if (scanning) setShownReport(null);
    else if (scanReport) setShownReport(scanReport);
  }, [scanning, scanReport]);

  useEffect(() => {
    if (!scanReport) setListOpen(false);
  }, [scanReport]);

  const handleStop = () => {
    setStopping(true);
    stopScan();
  };

  const handleDismiss = () => {
    setListOpen(false);
    dismissScanReport();
  };

  const report = scanning === null ? (scanReport ?? shownReport) : null;
  const open = scanning !== null || scanReport !== null;
  const info = scanning ?? shown;
  const indeterminate = !info || info.total <= 0;
  const percent = indeterminate ? 0 : Math.round((info!.done / info!.total) * 100);
  const skippedCount = report?.skipped.length ?? 0;
  const currentFilePath = report ? '' : (info?.currentFilePath ?? '');
  const currentFileName = currentFilePath.split('/').pop() ?? currentFilePath;

  useLayoutEffect(() => {
    const line = fileLineRef.current;
    const fullPath = fullPathRef.current;
    if (!line || !fullPath || !currentFilePath) {
      setFileNameOnly(false);
      return;
    }

    const measure = () => setFileNameOnly(fullPath.getBoundingClientRect().width > line.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(line);
    return () => observer.disconnect();
  }, [currentFilePath]);

  return (
    <>
      <div className={`xe_scan-drawer${open ? ' xe_scan-drawer--open' : ''}`} aria-hidden={!open}>
        <div className="xe_scan-drawer__head">
          {report ? <CheckIcon size={11} /> : <Spinner size={11} />}
          <span className="xe_scan-drawer__title">
            {report ? 'Finished scanning' : 'Importing'} <strong>{(report ?? info)?.folderName ?? ''}</strong>
          </span>
          <button
            type="button"
            className="xe_scan-drawer__stop"
            onClick={report ? handleDismiss : handleStop}
            disabled={!report && stopping}
            title={report ? 'Dismiss' : 'Stop scanning here'}
            aria-label={report ? 'Dismiss' : 'Stop scanning here'}
          >
            {report ? 'Dismiss' : stopping ? 'Aborting...' : 'Abort'}
          </button>
        </div>
        {!report && (
          <div
            className={`xe_scan-drawer__bar${indeterminate ? ' xe_scan-drawer__bar--indeterminate' : ''}`}
          >
            <div
              className="xe_scan-drawer__fill"
              style={indeterminate ? undefined : { width: `${percent}%` }}
            />
          </div>
        )}
        <div className="xe_scan-drawer__meta">
          {report ? (
            <span className="xe_scan-drawer__count">
              However, {skippedCount} file{skippedCount === 1 ? ' was' : 's were'} omitted.{' '}
              <button
                type="button"
                className="xe_scan-drawer__link"
                onClick={() => setListOpen(true)}
              >
                Which ones?
              </button>
            </span>
          ) : (
            <>
              <span className="xe_scan-drawer__count">
                {indeterminate
                  ? 'Starting scan, one moment...'
                  : `${info!.done}/${info!.total} ${info!.omitted > 0 ? ` - ${info!.omitted} excl` : ''}`}
                {rate !== null && !indeterminate && ` - ${formatRate(rate)}/s`}
                {!indeterminate &&
                  info!.audioSeconds > 0 &&
                  ` - ${formatDurationShort(info!.audioSeconds)}`}
              </span>
              {eta !== null && <span className="xe_scan-drawer__eta">{formatEta(eta)}</span>}
            </>
          )}
        </div>
        {!report && currentFilePath && (
          <div className="xe_scan-drawer__file" ref={fileLineRef} title={currentFilePath}>
            <span className="xe_scan-drawer__file-measure" ref={fullPathRef} aria-hidden="true">
              {currentFilePath}
            </span>
            <span>{fileNameOnly ? currentFileName : currentFilePath}</span>
          </div>
        )}
      </div>
      {listOpen &&
        scanReport &&
        createPortal(
          <Modal title={`Omitted from "${scanReport.folderName}"`} onClose={() => setListOpen(false)}>
            <div className="xe_omitted">
              <div className="xe_omitted__row xe_omitted__row--head">
                <span>What</span>
                <span>Why</span>
              </div>
              {scanReport.skipped.map((file) => (
                <div className="xe_omitted__row" key={file.path}>
                  <span className="xe_omitted__path" title={file.path}>
                    {file.path}
                  </span>
                  <span className="xe_omitted__reason">{file.reason}</span>
                </div>
              ))}
            </div>
          </Modal>,
          document.body
        )}
    </>
  );
}
