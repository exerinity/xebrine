export function TrackListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="xe_track-table__row xe_track-table__row--skeleton">
          <span className="xe_track-table__cell xe_track-table__cell--num">
            <span className="xe_skeleton" style={{ width: 16 }} />
          </span>
          <span className="xe_track-table__cell">
            <span className="xe_skeleton" style={{ width: `${55 + ((i * 29) % 35)}%` }} />
          </span>
          <span className="xe_track-table__cell">
            <span className="xe_skeleton" style={{ width: `${40 + ((i * 41) % 40)}%` }} />
          </span>
          <span className="xe_track-table__cell">
            <span className="xe_skeleton" style={{ width: `${45 + ((i * 17) % 35)}%` }} />
          </span>
          <span className="xe_track-table__cell xe_track-table__cell--dur">
            <span className="xe_skeleton" style={{ width: 28 }} />
          </span>
          <span className="xe_track-table__cell xe_track-table__cell--actions" />
        </div>
      ))}
    </div>
  );
}

export function LyricsSkeleton({ lines = 9 }: { lines?: number }) {
  return (
    <div className="xe_lyrics-skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className="xe_skeleton xe_skeleton--line"
          style={{ width: `${32 + ((i * 23) % 38)}%` }}
        />
      ))}
    </div>
  );
}
