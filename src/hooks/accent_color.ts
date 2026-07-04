import { useEffect, useState } from 'react';
import {
  DEFAULT_ACCENT_COLORS,
  extractAccentColors,
  type AccentColors
} from '../utils/accent_color';

export function useAccentColor(artworkUrl: string | null): AccentColors {
  const [colors, setColors] = useState<AccentColors>(DEFAULT_ACCENT_COLORS);

  useEffect(() => {
    if (!artworkUrl) {
      setColors(DEFAULT_ACCENT_COLORS);
      return;
    }

    let alive = true;
    extractAccentColors(artworkUrl)
      .then((next) => {
        if (alive) setColors(next);
      })
      .catch(() => {
        if (alive) setColors(DEFAULT_ACCENT_COLORS);
      });

    return () => {
      alive = false;
    };
  }, [artworkUrl]);

  return colors;
}
