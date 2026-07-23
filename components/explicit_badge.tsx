import { useIsExplicit } from '../hooks/explicit';

export function ExplicitIcon() {
  return (
    <span className="xe_explicit-badge" title="Explicit lyrics">
      E
    </span>
  );
}

export function ExplicitBadge({ trackId }: { trackId: string }) {
  const explicit = useIsExplicit(trackId);
  if (!explicit) return null;
  return <ExplicitIcon />;
}
