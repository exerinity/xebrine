/** @typedef {'success' | 'error' | 'info' | 'warning'} ToastVariant */

/**
 * @typedef {Object} ToastItem
 * @property {number} id
 * @property {ToastVariant} variant
 * @property {string} message
 * @property {number} duration
 */

const DEFAULT_DURATION = 7000;

let toasts = [];
let nextId = 1;
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener(toasts);
}

function push(variant, message, duration = DEFAULT_DURATION) {
  const id = nextId++;
  toasts = [...toasts, { id, variant, message, duration }];
  emit();
  return id;
}

function dismiss(id) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribeToasts(listener) {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}

export function dismissToast(id) {
  dismiss(id);
}

export const toast = {
  success: (message, duration) => push('success', message, duration),
  error: (message, duration) => push('error', message, duration),
  info: (message, duration) => push('info', message, duration),
  warning: (message, duration) => push('warning', message, duration)
};
