export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      className="xe_spinner"
      viewBox="0 0 24 24"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      <circle className="xe_spinner__track" cx="12" cy="12" r="9" fill="none" strokeWidth="2" />
      <circle className="xe_spinner__arc" cx="12" cy="12" r="9" fill="none" strokeWidth="2" />
    </svg>
  );
}
