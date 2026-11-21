export function isTypingTarget(target) {
  const el = target;
  const tag = el?.tagName?.toLowerCase() ?? '';
  return Boolean(
    el?.isContentEditable ||
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      el?.closest('[role="textbox"], [contenteditable="true"]')
  );
}

export function is_browser_history_arrow(e) {
  return e.altKey && (e.code === 'ArrowLeft' || e.code === 'ArrowRight');
}

export function is_browser_primary_chord(e) {
  return e.ctrlKey || e.metaKey;
}

export function track_jump_digit(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.code.startsWith('Digit')) {
    const num = parseInt(e.code.slice(5), 10);
    return Number.isNaN(num) ? null : num;
  }
  if (/^Numpad[0-9]$/.test(e.code)) {
    if (!e.getModifierState('NumLock')) return null;
    return parseInt(e.code.slice(6), 10);
  }
  return null;
}
