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
