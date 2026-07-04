import { useEffect, useRef } from 'react';

const SPEED_PX_PER_S = 40;
const PAUSE_MS = 1800;

interface ScrollingTextProps {
  text: string;
  className?: string;
  title?: string;
  onClick?: () => void;
}

export function ScrollingText({ text, className, title, onClick }: ScrollingTextProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const animationRef = useRef<Animation | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const el = textRef.current;
    if (!container || !el) return;

    let animation: Animation | null = null;
    const run = () => {
      animation?.cancel();
      animation = null;
      animationRef.current = null;
      const distance = el.scrollWidth - container.clientWidth;
      if (distance <= 2) return;
      const travelMs = (distance / SPEED_PX_PER_S) * 1000;
      const totalMs = 2 * PAUSE_MS + 2 * travelMs;
      animation = el.animate(
        [
          { transform: 'translateX(0)', offset: 0 },
          { transform: 'translateX(0)', offset: PAUSE_MS / totalMs },
          { transform: `translateX(${-distance}px)`, offset: (PAUSE_MS + travelMs) / totalMs },
          { transform: `translateX(${-distance}px)`, offset: (2 * PAUSE_MS + travelMs) / totalMs },
          { transform: 'translateX(0)', offset: 1 }
        ],
        { duration: totalMs, iterations: Infinity, easing: 'linear' }
      );
      animationRef.current = animation;
    };

    run();
    const observer = new ResizeObserver(run);
    observer.observe(container);
    return () => {
      observer.disconnect();
      animation?.cancel();
      animationRef.current = null;
    };
  }, [text]);

  return (
    <div
      ref={containerRef}
      className={`xe_scroll-text${className ? ` ${className}` : ''}${onClick ? ' xe_scroll-text--clickable' : ''}`}
      title={title ?? text}
      onMouseEnter={() => animationRef.current?.pause()}
      onMouseLeave={() => animationRef.current?.play()}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <span ref={textRef}>{text}</span>
    </div>
  );
}
