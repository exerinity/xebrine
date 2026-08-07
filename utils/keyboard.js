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
