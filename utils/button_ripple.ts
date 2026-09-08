export function installButtonRipples() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Map<HTMLElement, () => void>();

  const onClick = (event: MouseEvent) => {
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLElement>('button, a.xe_btn, [role="button"]');
    if (!button || button.matches(':disabled, [aria-disabled="true"]') ||
        button.closest('[inert], .xe_reduced-motion') || reducedMotion.matches) return;

    const rect = button.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    active.get(button)?.();

    const scaleX = button.offsetWidth / rect.width;
    const scaleY = button.offsetHeight / rect.height;
    const x = event.detail === 0 ? button.clientWidth / 2 :
      (event.clientX - rect.left) * scaleX - button.clientLeft;
    const y = event.detail === 0 ? button.clientHeight / 2 :
      (event.clientY - rect.top) * scaleY - button.clientTop;
    const diameter = Math.max(button.offsetWidth, button.offsetHeight);
    const layer = document.createElement('span');
    layer.className = 'xe_ripple-layer';
    layer.setAttribute('aria-hidden', 'true');
    const circle = document.createElement('span');
    circle.className = 'xe_ripple-circle';
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${x - diameter / 2}px`;
    circle.style.top = `${y - diameter / 2}px`;
    layer.append(circle);
    button.append(layer);

    const cleanup = () => {
      window.clearTimeout(timer);
      layer.remove();
      active.delete(button);
    };
    const timer = window.setTimeout(cleanup, 750);
    circle.addEventListener('animationend', cleanup, { once: true });
    active.set(button, cleanup);
  };

  document.addEventListener('click', onClick, true);
  return () => {
    document.removeEventListener('click', onClick, true);
    active.forEach(cleanup => cleanup());
  };
}