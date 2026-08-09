import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
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
const DRAG_SLOP = 8;

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  const closeRef = useRef(onClose);
  const [pos, setPos] = useState({ x, y });

  itemsRef.current = items;
  closeRef.current = onClose;

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
    let armed = true;
    let dragged = false;

    const onMove = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - x, e.clientY - y) > DRAG_SLOP) dragged = true;
    };
    const onDown = () => {
      armed = false;
    };
    const onUp = (e: MouseEvent) => {
      if (!armed) return;
      armed = false;
      if (!dragged) return;
      const target = e.target as Node | null;
      const item =
        target instanceof Element ? target.closest<HTMLElement>('[data-menu-index]') : null;
      if (item && ref.current?.contains(item)) {
        itemsRef.current[Number(item.dataset.menuIndex)]?.onSelect();
        closeRef.current();
      } else if (!target || !ref.current?.contains(target)) {
        closeRef.current();
      }
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('mouseup', onUp, true);
    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('mouseup', onUp, true);
    };
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
            data-menu-index={i}
            className="xe_context-menu__item"
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            {item.label}
            {item.icon && <span className="xe_context-menu__icon">{item.icon}</span>}
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
