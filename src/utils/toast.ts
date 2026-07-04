export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
  duration: number;
}

type Listener = (toasts: ToastItem[]) => void;

const DEFAULT_DURATION = 3500;

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

function push(variant: ToastVariant, message: string, duration = DEFAULT_DURATION) {
  const id = nextId++;
  toasts = [...toasts, { id, variant, message, duration }];
  emit();
  return id;
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}

export function dismissToast(id: number) {
  dismiss(id);
}

export const toast = {
  success: (message: string, duration?: number) => push('success', message, duration),
  error: (message: string, duration?: number) => push('error', message, duration),
  info: (message: string, duration?: number) => push('info', message, duration),
  warning: (message: string, duration?: number) => push('warning', message, duration)
};
