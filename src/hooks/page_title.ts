import { useEffect } from 'react';

const SUFFIX = 'Xebrine';
export function usePageTitle(crumbs: string | string[]) {
  const parts = (Array.isArray(crumbs) ? crumbs : [crumbs]).filter(Boolean);
  const title = [...parts, SUFFIX].join(' / ');
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = SUFFIX;
    };
  }, [title]);
}
