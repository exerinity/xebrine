import { useLayoutEffect, useRef, useState } from 'react';

export function use_drawer_presence(visible: boolean) {
  const drawer_ref = useRef<HTMLDivElement>(null);
  const [mounted, set_mounted] = useState(visible);
  const [entered, set_entered] = useState(false);

  useLayoutEffect(() => {
    const drawer = drawer_ref.current;
    if (visible) {
      set_mounted(true);
      drawer?.getBoundingClientRect();
      set_entered(true);
      return;
    }

    set_entered(false);
    if (!mounted || !drawer) return;

    let active = true;
    const animations = drawer.getAnimations();
    if (animations.length === 0) {
      set_mounted(false);
      return;
    }

    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (active) set_mounted(false);
    });

    return () => {
      active = false;
    };
  }, [visible, mounted]);

  return { drawer_ref, mounted: mounted || visible, open: visible && entered };
}
