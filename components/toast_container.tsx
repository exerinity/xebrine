import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { dismissToast, subscribeToasts, type ToastItem, type ToastVariant } from '../utils/toast';
import { CheckIcon, CloseIcon, ErrorIcon, InfoIcon, WarningIcon } from './icons';

const VARIANT_ICON: Record<ToastVariant, (props: { size?: number }) => ReactElement> = {
  success: CheckIcon,
  error: ErrorIcon,
  info: InfoIcon,
  warning: WarningIcon
};

function Toast({ item }: { item: ToastItem }) {
  const Icon = VARIANT_ICON[item.variant];
  const [leaving, setLeaving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [remaining, setRemaining] = useState(item.duration);
  const [countdownKey, setCountdownKey] = useState(0);
  const timed = Number.isFinite(item.duration) && item.duration > 0;

  useEffect(() => {
    if (!timed || leaving || hovered) return;
    if (remaining <= 0) {
      setLeaving(true);
      return;
    }
    const timer = window.setTimeout(() => setLeaving(true), remaining);
    return () => window.clearTimeout(timer);
  }, [hovered, leaving, remaining, timed]);

  const resetAndPauseDismissTimer = () => {
    if (!timed || leaving) return;
    setRemaining(item.duration);
    setCountdownKey((key) => key + 1);
    setHovered(true);
  };

  return (
    <div
      className={`xe_toast xe_toast--${item.variant}${leaving ? ' xe_toast--leaving' : ''}${
        hovered ? ' xe_toast--paused' : ''
      }`}
      role="status"
      onMouseEnter={resetAndPauseDismissTimer}
      onMouseLeave={() => setHovered(false)}
      onAnimationEnd={() => {
        if (leaving) dismissToast(item.id);
      }}
    >
      <Icon size={18} />
      <span className="xe_toast__message">{item.message}</span>
      <button
        type="button"
        className="xe_toast__close"
        onClick={() => setLeaving(true)}
        title="Dismiss"
        aria-label="Dismiss"
      >
        <CloseIcon size={14} />
      </button>
      {timed && !leaving && (
        <span
          key={countdownKey}
          className="xe_toast__timeout"
          style={{ '--toast-duration': `${item.duration}ms` } as CSSProperties}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToasts(setItems);
    return () => {
      unsubscribe();
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="xe_toast-stack">
      {items.map((item) => (
        <Toast key={item.id} item={item} />
      ))}
    </div>
  );
}
