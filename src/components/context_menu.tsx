import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  separatorBefore?: boolean;
  heading?: string;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const MARGIN = 8;

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (nx + rect.width > window.innerWidth - MARGIN) nx = window.innerWidth - rect.width - MARGIN;
    if (ny + rect.height > window.innerHeight - MARGIN) ny = window.innerHeight - rect.height - MARGIN;
    setPos({ x: Math.max(MARGIN, nx), y: Math.max(MARGIN, ny) });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="xe_context-menu"
      style={{ left: pos.x, top: pos.y }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.separatorBefore && <div className="xe_context-menu__sep" role="separator" />}
          {item.heading && (
            <div className="xe_context-menu__heading" role="presentation">
              {item.heading}
            </div>
          )}
          <button
            type="button"
            role="menuitem"
            className="xe_context-menu__item"
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
