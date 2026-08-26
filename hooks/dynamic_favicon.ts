import { useEffect, useRef } from 'react';
import { XEBRINE_LOGO_PATH, XEBRINE_LOGO_VIEW_BOX } from '../utils/logo';

interface OriginalFavicon {
  href: string | null;
  type: string | null;
}

function faviconDataUrl(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><svg x="11" y="11" width="78" height="78" viewBox="${XEBRINE_LOGO_VIEW_BOX}"><path fill="${color}" d="${XEBRINE_LOGO_PATH}"/></svg></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function restoreFavicon(favicon: HTMLLinkElement, original: OriginalFavicon): void {
  if (original.href === null) favicon.removeAttribute('href');
  else favicon.setAttribute('href', original.href);
  if (original.type === null) favicon.removeAttribute('type');
  else favicon.setAttribute('type', original.type);
}

export function useDynamicFavicon(active: boolean, color: string): void {
  const faviconRef = useRef<HTMLLinkElement | null>(null);
  const originalRef = useRef<OriginalFavicon | null>(null);

  useEffect(() => {
    const favicon =
      faviconRef.current ?? document.head.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!favicon) return;

    faviconRef.current = favicon;
    originalRef.current ??= {
      href: favicon.getAttribute('href'),
      type: favicon.getAttribute('type')
    };

    if (active) {
      favicon.type = 'image/svg+xml';
      favicon.href = faviconDataUrl(color);
      return;
    }

    restoreFavicon(favicon, originalRef.current);
  }, [active, color]);

  useEffect(
    () => () => {
      if (faviconRef.current && originalRef.current) {
        restoreFavicon(faviconRef.current, originalRef.current);
      }
    },
    []
  );
}
