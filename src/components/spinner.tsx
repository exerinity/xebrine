export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="xe_spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}
