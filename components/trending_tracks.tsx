import { useEffect, useMemo, useState } from 'react';
import { fetchTrendingTracks } from '../api/lastfm';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../src/context/player';
import { useAlbumArt } from '../hooks/album_art';
import { useTrackMenu } from '../hooks/track_menu';
import { matchTrendingTracks, type TrendingTrack } from '../utils/lastfm_trending';
import type { TrackMeta } from '../types';
import { ContextMenu } from './context_menu';
import { LogoIcon, PlayIcon, PlusIcon } from './icons';
import { Spinner } from './spinner';

export function LastfmTrackCard({
  entry,
  track,
  showPlaycount = false
}: {
  entry: TrendingTrack;
  track: TrackMeta;
  showPlaycount?: boolean;
}) {
  const { playNow, enqueueEnd, remoteLocked } = usePlayer();
  const { buildMenu } = useTrackMenu();
  const art = useAlbumArt(`track:${track.id}`, track);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      className="xe_album-card xe_trending-card"
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      <div className="xe_album-card__art">
        {art || entry.image ? <img src={art || entry.image || ''} alt="" loading="lazy" /> : <LogoIcon size={36} />}
        <button
          type="button"
          className="xe_trending-card__art-play"
          title={`Play ${track.title}`}
          aria-label={`Play ${track.title}`}
          disabled={remoteLocked}
          onClick={() => playNow([track], 0)}
        />
        {showPlaycount && Number.isFinite(entry.playcount) && (
          <span className="xe_trending-card__playcount">
            {entry.playcount!.toLocaleString()} {entry.playcount === 1 ? 'play' : 'plays'}
          </span>
        )}
        <div className="xe_album-card__actions">
          <button
            type="button"
            className="xe_album-card__action"
            title={`Enqueue ${track.title}`}
            aria-label={`Enqueue ${track.title}`}
            disabled={remoteLocked}
            onClick={() => enqueueEnd([track])}
          >
            <PlusIcon size={14} />
          </button>
          <button
            type="button"
            className="xe_album-card__play"
            title={`Play ${track.title}`}
            aria-label={`Play ${track.title}`}
            disabled={remoteLocked}
            onClick={() => playNow([track], 0)}
          >
            <PlayIcon size={18} />
          </button>
        </div>
      </div>
      <span className="xe_album-card__title" title={entry.title}>{entry.title}</span>
      <span className="xe_album-card__artist" title={entry.artist}>{entry.artist}</span>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={buildMenu(track)} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}

export function TrendingTracks({
  searchLimit,
  displayLimit,
  onMatchedTracks
}: {
  searchLimit: number;
  displayLimit: number;
  onMatchedTracks(trackIds: string[] | null): void;
}) {
  const { tracks } = useLibrary();
  const [chart, setChart] = useState<TrendingTrack[] | null>(null);

  useEffect(() => {
    let active = true;
    onMatchedTracks(null);
    setChart(null);
    fetchTrendingTracks(searchLimit)
      .then((tracks: TrendingTrack[]) => {
        if (active) setChart(tracks);
      })
      .catch(() => {
        if (active) setChart([]);
      });
    return () => {
      active = false;
    };
  }, [searchLimit, onMatchedTracks]);

  const matches = useMemo(
    () => matchTrendingTracks(chart ?? [], tracks).slice(0, displayLimit),
    [chart, displayLimit, tracks]
  );
  useEffect(() => {
    if (chart !== null) onMatchedTracks(matches.map(({ track }) => track.id));
  }, [chart, matches, onMatchedTracks]);
  if (chart !== null && matches.length === 0) return null;

  return (
    <section className="xe_home-section">
      <div className="xe_home-section__header">
        <h2 className="xe_home-section__title">Trending worldwide</h2>
      </div>
      {chart === null ? (
        <div className="xe_home-section__loading"><Spinner size={18} /></div>
      ) : (
        <div className="xe_home-carousel">
          {matches.map(({ entry, track }) => (
            <div className="xe_home-carousel__item" key={`${entry.artist}-${entry.title}`}>
              <LastfmTrackCard entry={entry} track={track} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
