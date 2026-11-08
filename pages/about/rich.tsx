import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from '../../components/spinner';
import { useLibrary } from '../../context/library_context';
import type { TrackMeta } from '../../types';
import { formatBytes, formatDurationShort, formatTime } from '../../utils/format';
import { groupAlbums, groupArtists } from '../../utils/groups';
import { toSlugParam } from '../../utils/slug';

const PALETTE = [
  '#f05138',
  '#3178c6',
  '#e3b341',
  '#8957e5',
  '#2da44e',
  '#db61a2',
  '#54aeff',
  '#fb8f44',
  '#6e7781',
  '#3fb950',
  '#d4a72c',
  '#a371f7'
];

const LOSSLESS = new Set(['flac', 'wav']);
const FEAT = /\b(feat\.?|ft\.?|featuring)\b|&/i;
const VARIOUS = /^(various artists|various|v\.?a\.?)$/i;
const NON_ASCII = /[^\u0000-\u007F]/;

const BITRATE_BUCKETS: { label: string; test: (kbps: number) => boolean }[] = [
  { label: 'Under 128', test: (kbps) => kbps < 128 },
  { label: '128-192', test: (kbps) => kbps < 192 },
  { label: '192-256', test: (kbps) => kbps < 256 },
  { label: '256-320', test: (kbps) => kbps <= 320 },
  { label: 'Over 320', test: () => true }
];

interface Slice {
  label: string;
  count: number;
  bytes: number;
  seconds: number;
  color: string;
}

interface AlbumStat {
  album: string;
  artist: string;
  tracks: number;
  seconds: number;
}

function extension_of(file_name: string): string {
  const dot = file_name.lastIndexOf('.');
  if (dot <= 0 || dot === file_name.length - 1) return '';
  return file_name.slice(dot + 1).toLowerCase();
}

function codec_label(extension: string): string {
  return extension ? extension.toUpperCase() : 'none';
}

function decade_label(year: number): string {
  if (year < 1900) return 'pre-1900';
  return `${Math.floor(year / 10) * 10}s`;
}

function share_label(count: number, total: number): string {
  if (!total || count <= 0) return '0%';
  const pct = (count / total) * 100;
  if (pct < 0.5) return '<1%';
  return `${Math.round(pct)}%`;
}

function percent_of(count: number, total: number): number {
  return total ? Math.round((count / total) * 100) : 0;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function plural(count: number, word: string): string {
  return `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;
}

function format_size(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return formatBytes(bytes);
}

function track_seconds(list: TrackMeta[]): number {
  return list.reduce((sum, track) => sum + (track.duration || 0), 0);
}

function paint(rows: Omit<Slice, 'color'>[]): Slice[] {
  return rows.map((row, index) => ({ ...row, color: PALETTE[index % PALETTE.length] }));
}

function top_slices(rows: Omit<Slice, 'color'>[], limit: number): Slice[] {
  const sorted = [...rows].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  if (sorted.length <= limit) return paint(sorted);
  const rest = sorted.slice(limit - 1);
  const other = rest.reduce(
    (sum, row) => ({
      label: 'Other',
      count: sum.count + row.count,
      bytes: sum.bytes + row.bytes,
      seconds: sum.seconds + row.seconds
    }),
    { label: 'Other', count: 0, bytes: 0, seconds: 0 }
  );
  return paint([...sorted.slice(0, limit - 1), other]);
}

function conic(slices: Slice[]): string {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  if (!total) return 'transparent';
  let cursor = 0;
  const stops = slices.map((slice) => {
    const start = cursor;
    cursor += (slice.count / total) * 100;
    return `${slice.color} ${start}% ${cursor}%`;
  });
  return `conic-gradient(${stops.join(',')})`;
}

function add_slice(map: Map<string, Omit<Slice, 'color'>>, label: string, track: TrackMeta) {
  const row = map.get(label) ?? { label, count: 0, bytes: 0, seconds: 0 };
  row.count += 1;
  row.bytes += track.sizeBytes || 0;
  row.seconds += track.duration || 0;
  map.set(label, row);
}

function format_stamp(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function AboutRichStats() {
  const { tracks, folders, scanning } = useLibrary();
  const stats = useMemo(() => build_rich_stats(tracks, folders), [tracks, folders]);

  if (scanning) {
    return (
      <div className="xe_about__scanning">
        <Spinner size={30} />
        <p>The stats will be calculated when the scan is finished, one moment...</p>
      </div>
    );
  }

  if (tracks.length === 0 || !stats) {
    return (
      <p className="xe_empty-note">
        Nothing to measure yet - <Link to="/settings/library">add a folder</Link>!
      </p>
    );
  }

  const dated_total = stats.decades.reduce((sum, slice) => sum + slice.count, 0);
  const lossy_total = stats.bitrate.reduce((sum, bucket) => sum + bucket.count, 0);
  const bitrate_max = Math.max(1, ...stats.bitrate.map((bucket) => bucket.count));
  const genre_max = Math.max(1, ...stats.genres.map((genre) => genre.seconds));
  const folder_max = Math.max(1, ...stats.folders.map((folder) => folder.bytes));
  const letter_max = Math.max(1, ...stats.letters.map((letter) => letter.count));
  const listening_days = stats.total_seconds / (8 * 3600);

  return (
    <>
      <p className="xe_about__lead">
        If you play for eight hours a day, this library will last you {listening_days.toFixed(listening_days >= 10 ? 0 : 1)} days.
        {stats.total_seconds > 0
          ? ` The files average ${Math.round(stats.average_kbps).toLocaleString()} kbps, estimated from size divided by duration`
          : ' Durations are missing, so bitrate cannot be estimated'}
      </p>

      <h3 className="xe_about__heading">Codecs</h3>
      <p className="xe_about__text">
        Lossless files are {share_label(stats.lossless_tracks, tracks.length)} of
        the tracks and {share_label(stats.lossless_bytes, stats.total_bytes)} of the bytes
      </p>
      <div className="xe_rich__codecs">
        <div className="xe_rich__donut" aria-hidden="true">
          <div className="xe_rich__donut-ring" style={{ background: conic(stats.codecs) }} />
          <div className="xe_rich__donut-hole">
            <strong>{stats.codec_count}</strong>
            <span>{stats.codec_count === 1 ? 'codec' : 'codecs'}</span>
          </div>
        </div>
        <ul className="xe_rich__legend">
          {stats.codecs.map((slice) => (
            <li key={slice.label}>
              <span className="xe_rich__swatch" style={{ background: slice.color }} />
              <span className="xe_rich__legend-name">{slice.label}</span>
              <span className="xe_rich__legend-meta">
                {share_label(slice.count, tracks.length)} / {slice.count.toLocaleString()} / {format_size(slice.bytes)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <h3 className="xe_about__heading">Decades</h3>
      {dated_total === 0 ? (
        <p className="xe_about__text">None of these tracks have a year tag</p>
      ) : (
        <>
          <p className="xe_about__text">
            Share of the {dated_total.toLocaleString()} dated tracks.
            {stats.undated > 0 && ` ${plural(stats.undated, 'track')} have no year tag`}
            {stats.decade_by_time && stats.decade_by_time.label !== stats.decades[0]?.label && (
              <>
                {' '}
                Most tracks are from the {stats.decades[0].label}, but the {stats.decade_by_time.label} hold{' '}
                {share_label(stats.decade_by_time.seconds, stats.dated_seconds)} of the dated runtime
              </>
            )}
          </p>
          <div
            className="xe_rich__lang"
            role="img"
            aria-label={stats.decades.map((slice) => `${share_label(slice.count, dated_total)} ${slice.label}`).join(', ')}
          >
            {stats.decades.map((slice) => (
              <span key={slice.label} style={{ flexGrow: slice.count, background: slice.color }} />
            ))}
          </div>
          <ul className="xe_rich__chips">
            {stats.decades.map((slice) => (
              <li key={slice.label}>
                <span className="xe_rich__swatch" style={{ background: slice.color }} />
                {share_label(slice.count, dated_total)} {slice.label}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="xe_about__heading">Artists with the most albums</h3>
      <p className="xe_about__text">
        {stats.top_artist
          ? `${stats.top_artist.name} is ${percent_of(stats.top_artist.tracks, tracks.length)}% of the library. The top 10 artists are ${percent_of(stats.top_10_tracks, tracks.length)}%`
          : 'Every track is filed under Unknown Artist. Strange!'}
      </p>
      {stats.artists.length > 0 && (
        <ol className="xe_rich__ranks">
          {stats.artists.map((artist, index) => (
            <li key={artist.name} className="xe_rich__rank">
              <span className="xe_rich__rank-n">{index + 1}</span>
              <Link to={`/artists/${toSlugParam(artist.name)}`}>{artist.name}</Link>
              <span className="xe_rich__rank-meta">
                {plural(artist.albums, 'album')} / {plural(artist.tracks, 'track')} / {formatDurationShort(artist.seconds)}
              </span>
            </li>
          ))}
        </ol>
      )}

      <h3 className="xe_about__heading">Where the time goes</h3>
      {stats.genres.length === 0 ? (
        <p className="xe_about__text">No genre tags to chart</p>
      ) : (
        <>
          <p className="xe_about__text">
            Top genres by runtime, across {plural(stats.genre_count, 'distinct genre')}.
          </p>
          <div className="xe_rich__bars">
            {stats.genres.map((genre) => (
              <div key={genre.label}>
                <div className="xe_rich__bar-label">
                  <span>{genre.label}</span>
                  <span>
                    {share_label(genre.seconds, stats.genre_seconds)} / {formatDurationShort(genre.seconds)}
                  </span>
                </div>
                <div className="xe_rich__bar" aria-hidden="true">
                  <span style={{ width: `${(genre.seconds / genre_max) * 100}%`, background: genre.color }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="xe_about__heading">Estimated bitrate</h3>
      <p className="xe_about__text">
        {stats.lossless_tracks > 0 && (
          <>
            {plural(stats.lossless_tracks, 'lossless file')}
            {stats.lossless_kbps.length > 0 && `, median ${Math.round(median(stats.lossless_kbps)).toLocaleString()} kbps`}
            .{' '}
          </>
        )}
        {lossy_total > 0
          ? `Lossy files have a median of ${Math.round(stats.median_lossy_kbps).toLocaleString()} kbps`
          : 'Nothing here looks lossy'}
      </p>
      {lossy_total > 0 && (
        <div className="xe_rich__bars">
          {stats.bitrate.map((bucket) => (
            <div key={bucket.label}>
              <div className="xe_rich__bar-label">
                <span>{bucket.label} kbps</span>
                <span>
                  {share_label(bucket.count, lossy_total)} / {plural(bucket.count, 'file')}
                </span>
              </div>
              <div className="xe_rich__bar" aria-hidden="true">
                <span style={{ width: `${(bucket.count / bitrate_max) * 100}%`, background: 'var(--accent)' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="xe_about__heading">How it is filed</h3>
      <div className="xe_rich__bars">
        <Meter label="Artist tag" value={stats.tagged_artist} total={tracks.length} />
        <Meter label="Album tag" value={stats.tagged_album} total={tracks.length} />
        <Meter label="Title tag" value={stats.tagged_title} total={tracks.length} />
        <Meter label="Year" value={tracks.length - stats.undated} total={tracks.length} />
        <Meter label="Track number" value={stats.numbered} total={tracks.length} />
        <Meter label="Cover art" value={stats.covers} total={tracks.length} />
      </div>

      <h3 className="xe_about__heading">Shape of the shelves</h3>
      <div className="xe_about__stats">
        <Fact value={stats.singles.toLocaleString()} label="1-track releases" />
        <Fact value={stats.self_titled.toLocaleString()} label="self-titled albums" />
        <Fact value={stats.collaborations.toLocaleString()} label="tracks with a feature" />
        <Fact value={stats.various_albums.toLocaleString()} label="various-artist albums" />
        <Fact value={stats.gapped_albums.toLocaleString()} label="albums with number gaps" />
        <Fact value={stats.extra_copies.toLocaleString()} label="extra copies of a recording" />
        <Fact value={stats.non_ascii.toLocaleString()} label="non-ASCII titles" />
        <Fact value={formatTime(stats.median_duration)} label="median duration" />
        <Fact value={formatTime(stats.mean_duration)} label="mean duration" />
        <Fact value={formatDurationShort(stats.median_album)} label="median album" />
      </div>
      <ul className="xe_about__list">
        {stats.largest && (
          <li>
            Largest file: <strong>{stats.largest.title}</strong> by {stats.largest.artist} ({format_size(stats.largest.sizeBytes)})
          </li>
        )}
        {stats.smallest && (
          <li>
            Smallest file: <strong>{stats.smallest.title}</strong> by {stats.smallest.artist} ({format_size(stats.smallest.sizeBytes)})
          </li>
        )}
        {stats.longest_album && (
          <li>
            Longest album: <strong>{stats.longest_album.album}</strong> by {stats.longest_album.artist} (
            {formatDurationShort(stats.longest_album.seconds)}, {plural(stats.longest_album.tracks, 'track')})
          </li>
        )}
        {stats.widest_album && stats.widest_album !== stats.longest_album && (
          <li>
            Most tracks on one album: <strong>{stats.widest_album.album}</strong> by {stats.widest_album.artist} (
            {plural(stats.widest_album.tracks, 'track')})
          </li>
        )}
        {stats.most_repeated && stats.most_repeated.count > 1 && (
          <li>
            Most repeated recording: <strong>{stats.most_repeated.title}</strong> by {stats.most_repeated.artist} x{' '}
            {stats.most_repeated.count}
          </li>
        )}
        {stats.longest_title && (
          <li>
            Longest title is {stats.longest_title.title.length} characters: <strong>{stats.longest_title.title}</strong>
          </li>
        )}
        {stats.oldest_file > 0 && stats.newest_file > 0 && (
          <li>
            File dates run from <strong>{format_stamp(stats.oldest_file)}</strong> to{' '}
            <strong>{format_stamp(stats.newest_file)}</strong>
          </li>
        )}
        {stats.deepest && (
          <li>
            Deepest path is {stats.deepest.relPath.length} folders down:{' '}
            <span>{stats.deepest.relPath.join('/')}</span>
          </li>
        )}
      </ul>

      <h3 className="xe_about__heading">Artist initials</h3>
      <p className="xe_about__text">
        {stats.busiest_letter
          ? `${stats.busiest_letter.letter} leads, with ${plural(stats.busiest_letter.count, 'artist')}`
          : 'No named artists to alphabetize'}
      </p>
      <div className="xe_rich__alpha-scroll">
        <div className="xe_rich__alpha">
          {stats.letters.map((letter) => (
            <div key={letter.letter} className="xe_rich__alpha-col" title={`${letter.letter}: ${plural(letter.count, 'artist')}`}>
              <div className="xe_rich__alpha-plot">
                <span
                  className="xe_rich__alpha-bar"
                  style={{ height: letter.count ? `${Math.max(6, (letter.count / letter_max) * 100)}%` : 0 }}
                />
              </div>
              <span>{letter.letter}</span>
            </div>
          ))}
        </div>
      </div>

      {stats.folders.length > 0 && (
        <>
          <h3 className="xe_about__heading">Heaviest folders</h3>
          <div className="xe_rich__bars">
            {stats.folders.map((folder) => (
              <div key={folder.id}>
                <div className="xe_rich__bar-label">
                  <span>{folder.name}</span>
                  <span>
                    {format_size(folder.bytes)} / {plural(folder.tracks, 'track')}
                  </span>
                </div>
                <div className="xe_rich__bar" aria-hidden="true">
                  <span style={{ width: `${(folder.bytes / folder_max) * 100}%`, background: 'var(--accent)' }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Meter({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="xe_rich__bar-label">
        <span>{label}</span>
        <span>
          {Math.round(pct)}% / {value.toLocaleString()}
        </span>
      </div>
      <div className="xe_rich__bar" role="img" aria-label={`${label}, ${Math.round(pct)} percent`}>
        <span style={{ width: `${pct}%`, background: 'var(--accent)' }} />
      </div>
    </div>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="xe_about__stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function build_rich_stats(tracks: TrackMeta[], folders: { id: string; name: string }[]) {
  if (!tracks.length) return null;

  const codecs = new Map<string, Omit<Slice, 'color'>>();
  const decades = new Map<string, Omit<Slice, 'color'>>();
  const genres = new Map<string, Omit<Slice, 'color'>>();
  const copies = new Map<string, { title: string; artist: string; count: number }>();
  const folder_totals = new Map<string, { tracks: number; bytes: number }>();
  const durations: number[] = [];
  const lossy_kbps: number[] = [];
  const lossless_kbps: number[] = [];
  const bitrate = BITRATE_BUCKETS.map((bucket) => ({ label: bucket.label, count: 0 }));

  let total_bytes = 0;
  let total_seconds = 0;
  let lossless_tracks = 0;
  let lossless_bytes = 0;
  let undated = 0;
  let dated_seconds = 0;
  let tagged_artist = 0;
  let tagged_album = 0;
  let tagged_title = 0;
  let numbered = 0;
  let covers = 0;
  let collaborations = 0;
  let non_ascii = 0;
  let largest: TrackMeta | null = null;
  let smallest: TrackMeta | null = null;
  let longest_title: TrackMeta | null = null;
  let deepest: TrackMeta | null = null;
  let oldest_file = 0;
  let newest_file = 0;

  for (const track of tracks) {
    const bytes = track.sizeBytes || 0;
    const seconds = track.duration || 0;
    total_bytes += bytes;
    total_seconds += seconds;
    if (seconds > 0) durations.push(seconds);

    const extension = extension_of(track.fileName);
    add_slice(codecs, codec_label(extension), track);
    if (LOSSLESS.has(extension)) {
      lossless_tracks += 1;
      lossless_bytes += bytes;
    }

    if (track.year) {
      add_slice(decades, decade_label(track.year), track);
      dated_seconds += seconds;
    } else {
      undated += 1;
    }

    const genre = track.genre?.trim();
    if (genre) {
      const genre_key = genre.toLowerCase();
      const row = genres.get(genre_key) ?? { label: genre, count: 0, bytes: 0, seconds: 0 };
      row.count += 1;
      row.bytes += bytes;
      row.seconds += seconds;
      genres.set(genre_key, row);
    }

    const copy_key = `${track.artist.toLowerCase()}\0${track.title.toLowerCase()}`;
    const copy = copies.get(copy_key) ?? { title: track.title, artist: track.artist, count: 0 };
    copy.count += 1;
    copies.set(copy_key, copy);

    const folder = folder_totals.get(track.folderId) ?? { tracks: 0, bytes: 0 };
    folder.tracks += 1;
    folder.bytes += bytes;
    folder_totals.set(track.folderId, folder);

    if (track.hasArtistTag) tagged_artist += 1;
    if (track.hasAlbumTag) tagged_album += 1;
    if (track.hasTitleTag) tagged_title += 1;
    if (track.trackNo) numbered += 1;
    if (track.hasCoverArt) covers += 1;
    if (FEAT.test(track.artist)) collaborations += 1;
    if (NON_ASCII.test(track.title)) non_ascii += 1;

    if (bytes > 0 && (!largest || bytes > largest.sizeBytes)) largest = track;
    if (bytes > 0 && (!smallest || bytes < smallest.sizeBytes)) smallest = track;
    if (!longest_title || track.title.length > longest_title.title.length) longest_title = track;
    if (!deepest || track.relPath.length > deepest.relPath.length) deepest = track;
    if (track.lastModified) {
      oldest_file = oldest_file ? Math.min(oldest_file, track.lastModified) : track.lastModified;
      newest_file = Math.max(newest_file, track.lastModified);
    }

    if (seconds > 0 && bytes > 0) {
      const kbps = (bytes * 8) / seconds / 1000;
      if (LOSSLESS.has(extension)) {
        lossless_kbps.push(kbps);
      } else {
        lossy_kbps.push(kbps);
        const index = BITRATE_BUCKETS.findIndex((bucket) => bucket.test(kbps));
        bitrate[index === -1 ? bitrate.length - 1 : index].count += 1;
      }
    }
  }

  let singles = 0;
  let self_titled = 0;
  let various_albums = 0;
  let gapped_albums = 0;
  let longest_album: AlbumStat | null = null;
  let widest_album: AlbumStat | null = null;
  const album_durations: number[] = [];
  for (const group of groupAlbums(tracks)) {
    const seconds = track_seconds(group.tracks);
    let max_track_no = 0;
    let numbered_tracks = 0;
    for (const track of group.tracks) {
      if (!track.trackNo) continue;
      numbered_tracks += 1;
      if (track.trackNo > max_track_no) max_track_no = track.trackNo;
    }
    const stat: AlbumStat = { album: group.album, artist: group.artist, tracks: group.tracks.length, seconds };
    if (seconds > 0) album_durations.push(seconds);
    if (stat.tracks === 1) singles += 1;
    const album_name = group.album.toLowerCase();
    const artist_name = group.artist.toLowerCase();
    if (album_name === artist_name && album_name !== 'unknown album' && artist_name !== 'unknown artist') self_titled += 1;
    if (VARIOUS.test(group.artist)) various_albums += 1;
    if (numbered_tracks > 0 && max_track_no > stat.tracks) gapped_albums += 1;
    if (!longest_album || seconds > longest_album.seconds) longest_album = stat;
    if (!widest_album || stat.tracks > widest_album.tracks) widest_album = stat;
  }

  let extra_copies = 0;
  let most_repeated: { title: string; artist: string; count: number } | null = null;
  for (const copy of copies.values()) {
    if (copy.count > 1) extra_copies += copy.count - 1;
    if (!most_repeated || copy.count > most_repeated.count) most_repeated = copy;
  }

  const named_artists = groupArtists(tracks).filter((artist) => artist.name.toLowerCase() !== 'unknown artist');
  const ranked_artists = [...named_artists].sort(
    (a, b) => b.albumCount - a.albumCount || b.tracks.length - a.tracks.length || a.name.localeCompare(b.name)
  );
  const by_tracks = [...named_artists].sort((a, b) => b.tracks.length - a.tracks.length);
  const letters = new Map<string, number>();
  for (const artist of named_artists) {
    const initial = artist.name.trim().charAt(0).toUpperCase();
    const bucket = /[A-Z]/.test(initial) ? initial : '#';
    letters.set(bucket, (letters.get(bucket) ?? 0) + 1);
  }
  const letter_rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').map((letter) => ({
    letter,
    count: letters.get(letter) ?? 0
  }));
  const busiest_letter = letter_rows.reduce((best, letter) => (letter.count > best.count ? letter : best), letter_rows[0]);

  const folder_names = new Map(folders.map((folder) => [folder.id, folder.name]));
  const decade_rows = top_slices([...decades.values()], 12);
  const decade_by_time = [...decades.values()].sort((a, b) => b.seconds - a.seconds)[0] ?? null;
  const genre_rows = [...genres.values()].sort((a, b) => b.seconds - a.seconds || b.count - a.count);
  const genre_seconds = genre_rows.reduce((sum, genre) => sum + genre.seconds, 0);
  const top_artist = by_tracks[0];

  return {
    total_bytes,
    total_seconds,
    average_kbps: total_seconds > 0 ? (total_bytes * 8) / total_seconds / 1000 : 0,
    codec_count: codecs.size,
    codecs: top_slices([...codecs.values()], 8),
    lossless_tracks,
    lossless_bytes,
    decades: decade_rows,
    decade_by_time,
    dated_seconds,
    undated,
    artists: ranked_artists.slice(0, 12).map((artist) => ({
      name: artist.name,
      albums: artist.albumCount,
      tracks: artist.tracks.length,
      seconds: track_seconds(artist.tracks)
    })),
    top_artist: top_artist ? { name: top_artist.name, tracks: top_artist.tracks.length } : null,
    top_10_tracks: by_tracks.slice(0, 10).reduce((sum, artist) => sum + artist.tracks.length, 0),
    genre_count: genres.size,
    genre_seconds,
    genres: paint(genre_rows.slice(0, 8)),
    bitrate,
    lossless_kbps,
    median_lossy_kbps: median(lossy_kbps),
    tagged_artist,
    tagged_album,
    tagged_title,
    numbered,
    covers,
    singles,
    self_titled,
    collaborations,
    various_albums,
    gapped_albums,
    extra_copies,
    non_ascii,
    median_duration: median(durations),
    mean_duration: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0,
    median_album: median(album_durations),
    largest,
    smallest,
    longest_album,
    widest_album,
    most_repeated,
    longest_title,
    deepest,
    oldest_file,
    newest_file,
    letters: letter_rows,
    busiest_letter: busiest_letter.count > 0 ? busiest_letter : null,
    folders: [...folder_totals.entries()]
      .map(([id, totals]) => ({
        id,
        name: folder_names.get(id) || 'Library folder',
        tracks: totals.tracks,
        bytes: totals.bytes
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 6)
  };
}
