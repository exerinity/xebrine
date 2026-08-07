import { useEffect } from 'react';
import { isElectron } from '../utils/electron';

const SUFFIX = 'Xebrine';
export function usePageTitle(crumbs) {
  const parts = (Array.isArray(crumbs) ? crumbs : [crumbs]).filter(Boolean);
  const title = (isElectron && parts.length ? parts : [...parts, SUFFIX]).join(' / ');
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = SUFFIX;
    };
  }, [title]);
}
