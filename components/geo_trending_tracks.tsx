import { useEffect, useMemo, useState } from 'react';
import { fetchGeoTrendingTracks } from '../api/lastfm';
import { useLibrary } from '../context/library_context';
import { matchTrendingTracks, type TrendingTrack } from '../utils/lastfm_trending';
import { estimateCountryFromTimezone } from '../utils/timezone_country';
import { countryName } from '../utils/countries';
import { LastfmTrackCard } from './trending_tracks';
import { Spinner } from './spinner';

export function GeoTrendingTracks({
  selectedCountry,
  searchLimit,
  displayLimit,
  excludedTrackIds
}: {
  selectedCountry: string;
  searchLimit: number;
  displayLimit: number;
  excludedTrackIds: string[] | null;
}) {
  const { tracks } = useLibrary();
  const estimatedCountry = useMemo(estimateCountryFromTimezone, []);
  const country = countryName(selectedCountry) ?? estimatedCountry;
  const [chart, setChart] = useState<TrendingTrack[] | null>(null);

  useEffect(() => {
    if (!country) return;
    let active = true;
    fetchGeoTrendingTracks(country, searchLimit)
      .then((tracks: TrendingTrack[]) => {
        if (active) setChart(tracks);
      })
      .catch(() => {
        if (active) setChart([]);
      });
    return () => {
      active = false;
    };
  }, [country, searchLimit]);

  const matches = useMemo(() => {
    const excluded = new Set(excludedTrackIds ?? []);
    return matchTrendingTracks(chart ?? [], tracks)
      .filter(({ track }) => !excluded.has(track.id))
      .slice(0, displayLimit);
  }, [chart, displayLimit, excludedTrackIds, tracks]);
  const waitingForWorldwide = excludedTrackIds === null;
  if (!country || (chart !== null && !waitingForWorldwide && matches.length === 0)) return null;

  return (
    <section className="xe_home-section">
      <div className="xe_home-section__header">
        <h2 className="xe_home-section__title">Trending in {country}</h2>
      </div>
      {chart === null || waitingForWorldwide ? (
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
