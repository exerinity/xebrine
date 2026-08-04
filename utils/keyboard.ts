export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase() ?? '';
  return Boolean(
    el?.isContentEditable ||
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      el?.closest('[role="textbox"], [contenteditable="true"]')
  );
}
