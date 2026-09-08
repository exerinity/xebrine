import { useEffect, useState } from 'react';
import { station_artwork_url, type radio_station_record } from '../../../api/radio_browser';

export function use_radio_artwork(station: radio_station_record | null): string | null {
  const key = station?.favicon ? `${station.stationuuid}:${station.favicon}` : '';
  const source = station?.favicon ? station_artwork_url(station) : '';
  const [artwork, set_artwork] = useState<{ key: string; url: string } | null>(null);

  useEffect(() => {
    if (!source) return;
    const controller = new AbortController();
    let object_url: string | null = null;
    void (async () => {
      try {
        const response = await fetch(source, { signal: controller.signal });
        if (!response.ok) return;
        const blob = await response.blob();
        if (controller.signal.aborted || !blob.type.startsWith('image/')) return;
        object_url = URL.createObjectURL(blob);
        const image = new Image();
        image.src = object_url;
        await image.decode();
        if (!controller.signal.aborted) set_artwork({ key, url: object_url });
      } catch {
        if (object_url) URL.revokeObjectURL(object_url);
        object_url = null;
      }
    })();
    return () => {
      controller.abort();
      if (object_url) URL.revokeObjectURL(object_url);
    };
  }, [key, source]);

  return artwork?.key === key ? artwork.url : null;
}
