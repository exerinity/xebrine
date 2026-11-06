type ripple_handle = { fade(): void; cancel(): void };

const TARGET = 'button, a.xe_btn, .xe_nav a, [role="button"]';

export function installButtonRipples() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Map<HTMLElement, ripple_handle>();
  let held: HTMLElement | null = null;

  const target_button = (event: Event): HTMLElement | null => {
    if (!(event.target instanceof Element)) return null;
    const button = event.target.closest<HTMLElement>(TARGET);
    if (!button || button.matches(':disabled, [aria-disabled="true"]') ||
        button.closest('[inert], .xe_reduced-motion') || reducedMotion.matches) return null;
    return button;
  };

  const createRipple = (event: MouseEvent | PointerEvent | KeyboardEvent, button: HTMLElement, center: boolean, hold: boolean) => {
    const rect = button.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    active.get(button)?.cancel();

    const scaleX = button.offsetWidth / rect.width;
    const scaleY = button.offsetHeight / rect.height;
    const point = 'clientX' in event && !center;
    const x = point ? (event.clientX - rect.left) * scaleX - button.clientLeft : button.clientWidth / 2;
    const y = point ? (event.clientY - rect.top) * scaleY - button.clientTop : button.clientHeight / 2;
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

    const expand = circle.animate(
      [{ transform: 'scale(0.08)' }, { transform: 'scale(2.6)' }],
      { duration: 440, easing: 'cubic-bezier(0.2, 0, 0.2, 1)', fill: 'forwards' }
    );

    let fade_anim: Animation | null = null;
    let fade_timer = 0;
    let fading = false;

    const cancel = () => {
      window.clearTimeout(fade_timer);
      expand.cancel();
      fade_anim?.cancel();
      layer.remove();
      active.delete(button);
      if (held === button) held = null;
    };

    const fade = () => {
      if (fading) return;
      fading = true;
      if (held === button) held = null;
      fade_anim = circle.animate(
        [{ opacity: 0.24 }, { opacity: 0 }],
        { duration: 280, easing: 'ease-out', fill: 'forwards' }
      );
      const finish = () => cancel();
      fade_timer = window.setTimeout(finish, 400);
      fade_anim.addEventListener('finish', finish, { once: true });
    };

    active.set(button, { fade, cancel });
    if (hold) held = button;
    else void expand.finished.then(fade).catch(() => {});
  };

  const release_held = () => {
    if (!held) return;
    active.get(held)?.fade();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    const button = target_button(event);
    if (!button) {
      release_held();
      return;
    }
    createRipple(event, button, false, true);
  };
  const onClick = (event: MouseEvent) => {
    if (event.detail !== 0) return;
    const button = target_button(event);
    if (!button || active.has(button)) return;
    createRipple(event, button, true, false);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
    const button = target_button(event);
    if (!button) return;
    createRipple(event, button, true, true);
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    release_held();
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointerup', release_held, true);
  document.addEventListener('pointercancel', release_held, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', release_held);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('pointerup', release_held, true);
    document.removeEventListener('pointercancel', release_held, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', release_held);
    active.forEach(handle => handle.cancel());
  };
}