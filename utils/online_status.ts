export function is_online(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}
