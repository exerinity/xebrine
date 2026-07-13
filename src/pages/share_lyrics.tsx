import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/player_context';
import { useSettings } from '../context/settings_context';
import { useAccentColor } from '../hooks/accent_color';
import { usePageTitle } from '../hooks/page_title';
import { dbGet } from '../management/db';
import {
  pickTextColor,
  renderShareCard,
  type CardBackground,
  type CardStyle,
  type LogoMode
} from '../utils/share_card';
import type { Lyrics, StoredLyrics } from '../types';
import { BackIcon, DownloadIcon } from '../components/icons';

const MAX_LINES = 7;
const STYLES: { id: CardStyle; label: string }[] = [
  { id: 'narrow', label: 'Narrow' },
  { id: 'square', label: 'Square' },
  { id: 'wide', label: 'Wide' }
];
const LOGO_POSITIONS: { id: Exclude<LogoMode, 'none'>; label: string }[] = [
  { id: 'wordmark', label: 'Bottom' },
  { id: 'corner', label: 'Top right' }
];

export function ShareLyricsPage() {
  const { current, artworkUrl, audioRef } = usePlayer();
  const { settings } = useSettings();
  const track = current?.track ?? null;
  const navigate = useNavigate();
  const accent = useAccentColor(artworkUrl);
  usePageTitle(['Share lyrics', 'Lyrics']);

  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [style, setStyle] = useState<CardStyle>('narrow');
  const [showLogo, setShowLogo] = useState(true);
  const [logoPosition, setLogoPosition] = useState<Exclude<LogoMode, 'none'>>('wordmark');
  const [bgMode, setBgMode] = useState<CardBackground>('solid');
  const [bgColor, setBgColor] = useState(accent.accent);
  const [textColor, setTextColor] = useState(pickTextColor(accent.accent));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setLyrics(null);
    setLoaded(false);
    setSelected([]);
    if (!track) return;
    let alive = true;
    void dbGet<StoredLyrics>('lyrics', track.id).then((stored) => {
      if (!alive) return;
      setLyrics(stored?.lyrics ?? null);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [track?.id]);

  useEffect(() => {
    setBgColor(accent.accent);
    setTextColor(pickTextColor(accent.accent));
  }, [accent]);

  const selectedLines = useMemo(() => {
    if (!lyrics) return [];
    return [...selected].sort((a, b) => a - b).map((i) => lyrics.lines[i].text);
  }, [lyrics, selected]);

  useEffect(() => {
    if (!track || selectedLines.length === 0) return;
    let alive = true;
    void renderShareCard({
      style,
      bg: bgColor,
      text: textColor,
      title: track.title,
      artist: track.artist,
      lines: selectedLines,
      artworkUrl,
      logo: showLogo ? logoPosition : 'none',
      background: bgMode,
      coverBlur: settings.fsBlur,
      coverSaturate: settings.fsSaturate
    }).then((rendered) => {
      const canvas = canvasRef.current;
      if (!alive || !canvas) return;
      canvas.width = rendered.width;
      canvas.height = rendered.height;
      canvas.getContext('2d')?.drawImage(rendered, 0, 0);
    });
    return () => {
      alive = false;
    };
  }, [
    track,
    selectedLines,
    style,
    bgColor,
    textColor,
    artworkUrl,
    showLogo,
    logoPosition,
    bgMode,
    settings.fsBlur,
    settings.fsSaturate
  ]);

  const selectSurrounding = () => {
    if (!lyrics) return;
    const t = audioRef.current?.currentTime ?? 0;
    const candidates: number[] = [];
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (lyrics.lines[i].text) candidates.push(i);
    }
    if (candidates.length === 0) return;
    let active = 0;
    for (let i = 0; i < lyrics.lines.length; i++) {
      const time = lyrics.lines[i].time;
      if (time !== null && time <= t) active = i;
    }
    let pos = 0;
    let bestDistance = Infinity;
    candidates.forEach((index, p) => {
      const distance = Math.abs(index - active);
      if (distance < bestDistance) {
        bestDistance = distance;
        pos = p;
      }
    });
    const start = Math.max(0, Math.min(pos - 3, candidates.length - MAX_LINES));
    setSelected(candidates.slice(start, start + MAX_LINES));
  };

  const toggleLine = (index: number) => {
    setSelected((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index);
      if (prev.length >= MAX_LINES) return prev;
      return [...prev, index];
    });
  };

  const resetColors = () => {
    setBgColor(accent.accent);
    setTextColor(pickTextColor(accent.accent));
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas || !track) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${track.artist} - ${track.title} lyrics.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <button type="button" className="xe_btn xe_btn--quiet xe_btn--back" onClick={() => navigate('/lyrics')}>
          <BackIcon size={16} />
          Back
        </button>
        <h1 className="xe_page__title">Share a screenshot of lyrics</h1>
        {track && <span className="xe_page__meta">{track.title} / {track.artist}</span>}
      </div>

      {!track ? (
        <p className="xe_empty-note">Play a song first, then come back here to share its lyrics.</p>
      ) : loaded && !lyrics ? (
        <p className="xe_empty-note">No lyrics saved for this track yet - find them on the Lyrics page first.</p>
      ) : lyrics ? (
        <div className="xe_share">
          <div className="xe_share__picker">
            <div className="xe_share__picker-head">
              <span className="xe_share__count">
                {selected.length}/{MAX_LINES} lines selected
              </span>
              {lyrics.synced && (
                <button type="button" className="xe_btn xe_btn--small" onClick={selectSurrounding}>
                  Select surrounding lines
                </button>
              )}
              {selected.length > 0 && (
                <button type="button" className="xe_btn xe_btn--quiet xe_btn--small" onClick={() => setSelected([])}>
                  Clear
                </button>
              )}
            </div>
            <div className="xe_share__lines">
              {lyrics.lines.map((line, i) => {
                if (!line.text) return null;
                const isSelected = selected.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    className={`xe_share-line${isSelected ? ' xe_share-line--selected' : ''}`}
                    onClick={() => toggleLine(i)}
                    disabled={!isSelected && selected.length >= MAX_LINES}
                  >
                    {line.text}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="xe_share__side">
            <div className="xe_share__controls">
              <div className="xe_share__field">
                <span className="xe_share__label">Style</span>
                <div className="xe_share__styles">
                  {STYLES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`xe_share__style${style === option.id ? ' xe_share__style--on' : ''}`}
                      onClick={() => setStyle(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="xe_share__field">
                <span className="xe_share__label">Background</span>
                <div className="xe_share__styles">
                  <button
                    type="button"
                    className={`xe_share__style${bgMode === 'solid' ? ' xe_share__style--on' : ''}`}
                    onClick={() => setBgMode('solid')}
                  >
                    Solid
                  </button>
                  <button
                    type="button"
                    className={`xe_share__style${bgMode === 'cover' ? ' xe_share__style--on' : ''}`}
                    onClick={() => setBgMode('cover')}
                    disabled={!artworkUrl}
                  >
                    Cover art
                  </button>
                </div>
                <input
                  type="color"
                  className="xe_share__color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  disabled={bgMode === 'cover'}
                />
              </div>
              <div className="xe_share__field">
                <span className="xe_share__label">Text</span>
                <input
                  type="color"
                  className="xe_share__color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                />
              </div>
              <label className="xe_share__toggle">
                <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} />
                <span>Logo</span>
              </label>
              {showLogo && (
                <div className="xe_share__field">
                  <span className="xe_share__label">Logo position</span>
                  <div className="xe_share__styles">
                    {LOGO_POSITIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`xe_share__style${logoPosition === option.id ? ' xe_share__style--on' : ''}`}
                        onClick={() => setLogoPosition(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" className="xe_btn xe_btn--quiet xe_btn--small" onClick={resetColors}>
                Reset colors
              </button>
            </div>

            {selected.length > 0 ? (
              <canvas ref={canvasRef} className={`xe_share__canvas xe_share__canvas--${style}`} />
            ) : (
              <div className={`xe_share__placeholder xe_share__canvas--${style}`}>
                Select up to {MAX_LINES} lines
              </div>
            )}

            <button
              type="button"
              className="xe_btn xe_btn--accent"
              onClick={download}
              disabled={selected.length === 0}
            >
              <DownloadIcon size={14} />
              Download
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
