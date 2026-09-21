import { useEffect, useState } from "react";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function Spinner({
  size = 16,
  interval = 80,
}: {
  size?: number;
  interval?: number;
}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setFrame((f) => (f + 1) % FRAMES.length),
      interval
    );
    return () => clearInterval(id);
  }, [interval]);

  return (
    <span
      className="xe_spinner"
      role="status"
      aria-label="Loading"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        fontSize: size,
        lineHeight: 1,
        textAlign: "center",
        fontFamily: "monospace",
        userSelect: "none",
      }}
    >
      <span aria-hidden="true">{FRAMES[frame]}</span>
    </span>
  );
}