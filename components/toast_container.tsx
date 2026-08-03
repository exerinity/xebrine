import { useEffect, useState, type ReactElement } from 'react';
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

  useEffect(() => {
    if (!Number.isFinite(item.duration) || item.duration <= 0) return;
    const timer = window.setTimeout(() => setLeaving(true), item.duration);
    return () => window.clearTimeout(timer);
  }, [item.id, item.duration]);

  return (
    <div
      className={`xe_toast xe_toast--${item.variant}${leaving ? ' xe_toast--leaving' : ''}`}
      role="status"
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
