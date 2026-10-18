import { useEffect, useMemo, useState } from 'react';
import { fetchUserTopTracks } from '../api/lastfm';
import { useLibrary } from '../context/library_context';
import { useLastfmSession } from '../hooks/lastfm_session';
import { matchTrendingTracks, type TrendingTrack } from '../utils/lastfm_trending';
import { LastfmTrackCard } from './trending_tracks';
import { Spinner } from './spinner';
import { use_online } from '../hooks/online_status';

export function TopTracksSection({
  title,
  period,
  displayLimit
}: {
  title: string;
  period: '7day' | 'overall';
  displayLimit: number;
}) {
  const { tracks } = useLibrary();
  const online = use_online();
  const session = useLastfmSession();
  const [chart, setChart] = useState<TrendingTrack[] | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    if (!online) {
      setChart((current) => current ?? []);
      return;
    }
    setChart(null);
    fetchUserTopTracks(session.username, period)
      .then((tracks: TrendingTrack[]) => {
        if (active) setChart(tracks);
      })
      .catch(() => {
        if (active) setChart([]);
      });
    return () => {
      active = false;
    };
  }, [period, session?.username, online]);

  const matches = useMemo(
    () => matchTrendingTracks(chart ?? [], tracks).slice(0, displayLimit),
    [chart, displayLimit, tracks]
  );
  if (!session || (chart !== null && matches.length === 0)) return null;

  return (
    <section className="xe_home-section">
      <div className="xe_home-section__header">
        <h2 className="xe_home-section__title">{title}</h2>
      </div>
      {chart === null ? (
        <div className="xe_home-section__loading"><Spinner size={18} /></div>
      ) : (
        <div className="xe_home-carousel">
          {matches.map(({ entry, track }) => (
            <div className="xe_home-carousel__item" key={`${entry.artist}-${entry.title}`}>
              <LastfmTrackCard entry={entry} track={track} showPlaycount />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function TopTracks({ displayLimit }: { displayLimit: number }) {
  const session = useLastfmSession();
  if (!session) return null;
  return (
    <>
      <TopTracksSection title="Your top tracks this week" period="7day" displayLimit={displayLimit} />
      <TopTracksSection title="Your top tracks of all time" period="overall" displayLimit={displayLimit} />
    </>
  );
}
