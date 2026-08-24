import { useLibrary } from '../context/library_context';
import { Spinner } from './spinner';

export function ScanStatusBanner() {
  const { scanning } = useLibrary();
  if (!scanning) return null;

  return (
    <div className="xe_banner xe_banner--info">
      <Spinner size={14} />
      <span>
        A scan is currently ongoing! What you see is not updated in realtime: it is from before the scan. This will be
        updated when finished
      </span>
    </div>
  );
}
