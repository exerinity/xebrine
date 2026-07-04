import { useRef, type PointerEvent } from 'react';
import { clamp } from '../utils/format';
import { useWheel } from '../hooks/wheel';

interface SliderProps {
  value: number;
  min?: number;
  max: number;
  onChange(value: number): void;
  onCommit?(value: number): void;
  wheelStep?: number;
  markAt?: number;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function Slider({
  value,
  min = 0,
  max,
  onChange,
  onCommit,
  wheelStep,
  markAt,
  disabled,
  ariaLabel,
  className
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const range = max - min || 1;
  const fraction = clamp((value - min) / range, 0, 1);
  const commit = onCommit ?? onChange;

  const valueFromEvent = (clientX: number): number => {
    const rect = trackRef.current!.getBoundingClientRect();
    const f = clamp((clientX - rect.left) / rect.width, 0, 1);
    return min + f * range;
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    let latest = valueFromEvent(e.clientX);
    onChange(latest);
    const onPointerMove = (ev: globalThis.PointerEvent) => {
      latest = valueFromEvent(ev.clientX);
      onChange(latest);
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      commit(latest);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const step = wheelStep ?? range / 20;
  useWheel(trackRef, (direction) => {
    if (disabled) return;
    commit(clamp(valueRef.current + direction * step, min, max));
  });

  return (
    <div
      ref={trackRef}
      className={`xe_slider${disabled ? ' xe_slider--disabled' : ''}${className ? ` ${className}` : ''}`}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
    >
      <div className="xe_slider__track">
        <div className="xe_slider__fill" style={{ width: `${fraction * 100}%` }} />
        {markAt !== undefined && (
          <div
            className="xe_slider__mark"
            style={{ left: `${clamp((markAt - min) / range, 0, 1) * 100}%` }}
          />
        )}
        <div className="xe_slider__thumb" style={{ left: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}
