import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CountUp } from '../../components/count_up';
import { Spinner } from '../../components/spinner';
import { useLibrary } from '../../context/library_context';
import { albumKey, displayArtist } from '../../utils/groups';
import { durationBreakdown, formatBytes, formatTime } from '../../utils/format';
import type { TrackMeta } from '../../types';

export function AboutStats() {
  const { tracks, folders, scanning } = useLibrary();
  const stats = useMemo(() => {
    const artists = new Set<string>();
    const albums = new Set<string>();
    const genres = new Set<string>();
    const subfolders = new Set<string>();
    const formats = new Map<string, number>();
    let total_seconds = 0;
    let total_bytes = 0;
    let with_cover_art = 0;
    let longest: TrackMeta | null = null;
    let shortest: TrackMeta | null = null;
    let earliest_year = 0;
    let latest_year = 0;

    for (const track of tracks) {
      total_seconds += track.duration || 0;
      total_bytes += track.sizeBytes || 0;
      artists.add(displayArtist(track).toLowerCase());
      albums.add(albumKey(track));
      if (track.genre?.trim()) genres.add(track.genre.trim().toLowerCase());
      if (track.hasCoverArt) with_cover_art++;

      const extension = track.fileName.includes('.')
        ? track.fileName.split('.').pop()!.toLowerCase()
        : '';
      if (extension) formats.set(extension, (formats.get(extension) ?? 0) + 1);

      const directory = track.relPath.slice(0, -1);
      for (let index = 1; index <= directory.length; index++) {
        subfolders.add(`${track.folderId}/${directory.slice(0, index).join('/')}`);
      }

      if (track.duration > 0) {
        if (!longest || track.duration > longest.duration) longest = track;
        if (!shortest || track.duration < shortest.duration) shortest = track;
      }
      if (track.year) {
        earliest_year = earliest_year ? Math.min(earliest_year, track.year) : track.year;
        latest_year = Math.max(latest_year, track.year);
      }
    }

    return {
      total_seconds,
      total_bytes,
      artists: artists.size,
      albums: albums.size,
      genres: genres.size,
      subfolders: subfolders.size,
      with_cover_art,
      longest: longest as TrackMeta | null,
      shortest: shortest as TrackMeta | null,
      earliest_year,
      latest_year,
      formats: [...formats.entries()].sort((a, b) => b[1] - a[1]),
      average_seconds: tracks.length ? total_seconds / tracks.length : 0
    };
  }, [tracks]);

  if (scanning) {
    return (
      <div className="xe_about__scanning">
        <Spinner size={30} />
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <p className="xe_empty-note">
        Nothing to measure yet - <Link to="/settings/library">add a folder</Link>!
      </p>
    );
  }

  const breakdown = durationBreakdown(stats.total_seconds);

  return (
    <>
      <h3 className="xe_about__heading">Your library has a runtime of...</h3>
      <div className="xe_about__duration">
        <div className="xe_about__duration-parts">
          {breakdown.map((part, index) => (
            <div key={part.unit} className="xe_about__duration-part">
              <strong>
                <CountUp value={part.value} delay={index * 110} />
              </strong>
              <span>
                {part.unit}
                {part.value === 1 ? '' : 's'}
              </span>
            </div>
          ))}
        </div>
        <p className="xe_about__duration-note">
          <CountUp value={Math.floor(stats.total_seconds)} delay={breakdown.length * 110} />{' '}
          seconds in total, counting years as 365 days, months as 30, and weeks as 7
        </p>
      </div>

      <h3 className="xe_about__heading">The big numbers</h3>
      <div className="xe_about__stats">
        <div className="xe_about__stat">
          <strong><CountUp value={tracks.length} /></strong>
          <span>track{tracks.length === 1 ? '' : 's'}</span>
        </div>
        <div className="xe_about__stat">
          <strong><CountUp value={stats.artists} delay={60} /></strong>
          <span>artist{stats.artists === 1 ? '' : 's'}</span>
        </div>
        <div className="xe_about__stat">
          <strong><CountUp value={stats.albums} delay={120} /></strong>
          <span>album{stats.albums === 1 ? '' : 's'}</span>
        </div>
        <div className="xe_about__stat">
          <strong><CountUp value={stats.genres} delay={180} /></strong>
          <span>genre{stats.genres === 1 ? '' : 's'}</span>
        </div>
        <div className="xe_about__stat">
          <strong><CountUp value={folders.length} delay={240} /></strong>
          <span>library folder{folders.length === 1 ? '' : 's'}</span>
        </div>
        <div className="xe_about__stat">
          <strong><CountUp value={stats.subfolders} delay={300} /></strong>
          <span>subfolder{stats.subfolders === 1 ? '' : 's'}</span>
        </div>
        <div className="xe_about__stat">
          <strong><CountUp value={stats.total_bytes} delay={360} format={formatBytes} /></strong>
          <span>on disk</span>
        </div>
        <div className="xe_about__stat">
          <strong><CountUp value={stats.average_seconds} delay={420} format={formatTime} /></strong>
          <span>average duration</span>
        </div>
      </div>

      <h3 className="xe_about__heading">Tidbits</h3>
      <ul className="xe_about__list">
        {stats.longest && (
          <li>
            Longest track: <strong>{stats.longest.title}</strong> by {stats.longest.artist}{' '}
            ({formatTime(stats.longest.duration)})
          </li>
        )}
        {stats.shortest && (
          <li>
            Shortest track: <strong>{stats.shortest.title}</strong> by {stats.shortest.artist}{' '}
            ({formatTime(stats.shortest.duration)})
          </li>
        )}
        {stats.earliest_year > 0 && (
          <li>
            Your library has songs released between <strong>{stats.earliest_year}</strong> and{' '}
            <strong>{stats.latest_year}</strong>, spanning{' '}
            {stats.latest_year - stats.earliest_year + 1} year
            {stats.latest_year - stats.earliest_year === 0 ? '' : 's'}
          </li>
        )}
        <li>
          <strong>{stats.with_cover_art.toLocaleString()}</strong> of {tracks.length}{' '}
          track{tracks.length === 1 ? '' : 's'} have cover art ({Math.round((stats.with_cover_art / tracks.length) * 100)}%)
        </li>
        <li>
          Averaging <strong>{formatBytes(Math.round(stats.total_bytes / tracks.length))}</strong>{' '}
          and {(tracks.length / Math.max(1, stats.albums)).toFixed(1)} tracks per album
        </li>
        <li>
          The most prominent formats are:{' '}
          {stats.formats
            .map(([extension, count]) => `${extension.toLowerCase()} (${count.toLocaleString()})`)
            .join(', ')}
        </li>
      </ul>
    </>
  );
}
