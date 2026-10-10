import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  onSelect?: () => void;
  icon?: ReactNode;
  separatorBefore?: boolean;
  heading?: string;
  submenu?: ContextMenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  scrollRoot?: RefObject<HTMLElement | null>;
}

const MARGIN = 8;
const DRAG_SLOP = 8;
const SUBMENU_GAP = 4;
const SUBMENU_HOVER_DELAY = 400;

interface MenuPanelProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  anchor?: DOMRect;
  menuId: string;
  path: number[];
  openPath: number[];
  submenuAnchors: Record<string, DOMRect>;
  onOpenSubmenu: (path: number[], anchor: DOMRect) => void;
  onCloseSubmenus: (path: number[]) => void;
  onSelect: (path: number[]) => void;
}

function menu_item_at_path(items: ContextMenuItem[], path: number[]) {
  let current_items = items;
  let item: ContextMenuItem | undefined;
  for (const index of path) {
    item = current_items[index];
    if (!item) return undefined;
    current_items = item.submenu ?? [];
  }
  return item;
}

function focus_menu_item(menu_id: string, path: number[]) {
  const menu_path = path.join('.');
  const item = Array.from(document.querySelectorAll<HTMLElement>('[data-menu-path]')).find(
    element =>
      element.dataset.menuPath === menu_path &&
      element.closest<HTMLElement>('[data-context-menu-id]')?.dataset.contextMenuId === menu_id
  );
  item?.focus();
}

function MenuPanel({
  x,
  y,
  items,
  anchor,
  menuId,
  path,
  openPath,
  submenuAnchors,
  onOpenSubmenu,
  onCloseSubmenus,
  onSelect
}: MenuPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const submenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState({ x, y });

  const clearSubmenuTimer = () => {
    if (submenuTimer.current === null) return;
    clearTimeout(submenuTimer.current);
    submenuTimer.current = null;
  };

  const openSubmenuAfterDelay = (item_path: number[], anchor: DOMRect) => {
    clearSubmenuTimer();
    submenuTimer.current = setTimeout(() => {
      onOpenSubmenu(item_path, anchor);
      submenuTimer.current = null;
    }, SUBMENU_HOVER_DELAY);
  };

  const focus_adjacent_item = (item_path: number[], direction: number) => {
    const menu_items = Array.from(ref.current?.children ?? []).flatMap(item => {
      const button = item.querySelector<HTMLElement>(':scope > [data-menu-path]');
      return button ? [button] : [];
    });
    const index = menu_items.findIndex(item => item.dataset.menuPath === item_path.join('.'));
    if (index < 0 || menu_items.length === 0) return;
    menu_items[(index + direction + menu_items.length) % menu_items.length].focus();
  };

  useEffect(() => clearSubmenuTimer, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (nx + rect.width > window.innerWidth - MARGIN && anchor) {
      nx = anchor.left - rect.width - SUBMENU_GAP;
    }
    if (nx + rect.width > window.innerWidth - MARGIN) nx = window.innerWidth - rect.width - MARGIN;
    if (ny + rect.height > window.innerHeight - MARGIN) ny = window.innerHeight - rect.height - MARGIN;
    setPos({ x: Math.max(MARGIN, nx), y: Math.max(MARGIN, ny) });
  }, [anchor, items, x, y]);

  return (
    <div
      ref={ref}
      className="xe_context-menu"
      data-context-menu-id={menuId}
      style={{ left: pos.x, top: pos.y }}
      role="menu"
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item, index) => {
        const item_path = [...path, index];
        const has_submenu = Boolean(item.submenu?.length);
        const submenu_is_open =
          has_submenu && item_path.every((path_index, path_index_index) => openPath[path_index_index] === path_index);
        const submenu_anchor = submenuAnchors[item_path.join('.')];

        return (
          <div key={index}>
            {item.separatorBefore && <div className="xe_context-menu__sep" role="separator" />}
            {item.heading && (
              <div className="xe_context-menu__heading" role="presentation">
                {item.heading}
              </div>
            )}
            <button
              type="button"
              role="menuitem"
              data-menu-path={item_path.join('.')}
              aria-haspopup={has_submenu ? 'menu' : undefined}
              aria-expanded={has_submenu ? submenu_is_open : undefined}
              className="xe_context-menu__item"
              onMouseEnter={(event) => {
                if (has_submenu) openSubmenuAfterDelay(item_path, event.currentTarget.getBoundingClientRect());
                else {
                  clearSubmenuTimer();
                  onCloseSubmenus(item_path.slice(0, -1));
                }
              }}
              onMouseLeave={() => {
                clearSubmenuTimer();
              }}
              onFocus={(event) => {
                clearSubmenuTimer();
                if (has_submenu) onOpenSubmenu(item_path, event.currentTarget.getBoundingClientRect());
                else onCloseSubmenus(item_path.slice(0, -1));
              }}
              onClick={(event) => {
                if (has_submenu) {
                  clearSubmenuTimer();
                  if (item.onSelect) {
                    onSelect(item_path);
                    return;
                  }
                  onOpenSubmenu(item_path, event.currentTarget.getBoundingClientRect());
                  return;
                }
                onSelect(item_path);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                if (has_submenu) {
                  clearSubmenuTimer();
                  if (item.onSelect) {
                    onSelect(item_path);
                    return;
                  }
                  onOpenSubmenu(item_path, event.currentTarget.getBoundingClientRect());
                  return;
                }
                onSelect(item_path);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  focus_adjacent_item(item_path, 1);
                  return;
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  focus_adjacent_item(item_path, -1);
                  return;
                }
                if (event.key === 'ArrowRight' && has_submenu) {
                  event.preventDefault();
                  clearSubmenuTimer();
                  onOpenSubmenu(item_path, event.currentTarget.getBoundingClientRect());
                  requestAnimationFrame(() => focus_menu_item(menuId, [...item_path, 0]));
                  return;
                }
                if (event.key === 'ArrowLeft' && path.length > 0) {
                  event.preventDefault();
                  onCloseSubmenus(path.slice(0, -1));
                  requestAnimationFrame(() => focus_menu_item(menuId, path.slice(0, -1)));
                }
              }}
            >
              {item.label}
              {has_submenu ? (
                <svg
                  className="xe_context-menu__submenu-indicator"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M16.586 13l-5.043 5.04 1.414 1.42L20.414 12l-7.457-7.46-1.414 1.42L16.586 11H3v2h13.586z" />
                </svg>
              ) : (
                item.icon && <span className="xe_context-menu__icon">{item.icon}</span>
              )}
            </button>
            {submenu_is_open && item.submenu && submenu_anchor && (
              <MenuPanel
                x={submenu_anchor.right + SUBMENU_GAP}
                y={submenu_anchor.top}
                items={item.submenu}
                anchor={submenu_anchor}
                menuId={menuId}
                path={item_path}
                openPath={openPath}
                submenuAnchors={submenuAnchors}
                onOpenSubmenu={onOpenSubmenu}
                onCloseSubmenus={onCloseSubmenus}
                onSelect={onSelect}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ContextMenu({ x, y, items, onClose, scrollRoot }: ContextMenuProps) {
  const menuId = useId();
  const itemsRef = useRef(items);
  const closeRef = useRef(onClose);
  const [openPath, setOpenPath] = useState<number[]>([]);
  const [submenuAnchors, setSubmenuAnchors] = useState<Record<string, DOMRect>>({});

  itemsRef.current = items;
  closeRef.current = onClose;

  useEffect(() => {
    setOpenPath([]);
    setSubmenuAnchors({});
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
        target instanceof Element ? target.closest<HTMLElement>('[data-menu-path]') : null;
      const menu = target instanceof Element ? target.closest<HTMLElement>('[data-context-menu-id]') : null;
      if (item?.dataset.menuPath && menu?.dataset.contextMenuId === menuId) {
        const menu_item = menu_item_at_path(itemsRef.current, item.dataset.menuPath.split('.').map(Number));
        if (menu_item?.onSelect) {
          menu_item?.onSelect?.();
          closeRef.current();
        }
      } else if (menu?.dataset.contextMenuId !== menuId) {
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
      const menu = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-context-menu-id]') : null;
      if (menu?.dataset.contextMenuId !== menuId) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      const focused_menu =
        document.activeElement instanceof Element
          ? document.activeElement.closest<HTMLElement>('[data-context-menu-id]')
          : null;
      if (focused_menu?.dataset.contextMenuId !== menuId) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          focus_menu_item(menuId, [0]);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          focus_menu_item(menuId, [itemsRef.current.length - 1]);
          return;
        }
      }
      if (e.key === 'Escape') closeRef.current();
    };
    const onResize = () => closeRef.current();
    const onScroll = (e: Event) => {
      const target = e.target;
      const isolatedRoot =
        target instanceof Element ? target.closest<HTMLElement>('[data-context-menu-scroll-root]') : null;
      if (isolatedRoot && isolatedRoot !== scrollRoot?.current) return;
      closeRef.current();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [menuId, scrollRoot]);

  return createPortal(
    <MenuPanel
      x={x}
      y={y}
      items={items}
      menuId={menuId}
      path={[]}
      openPath={openPath}
      submenuAnchors={submenuAnchors}
      onOpenSubmenu={(path, anchor) => {
        setOpenPath(path);
        setSubmenuAnchors(previous => ({ ...previous, [path.join('.')]: anchor }));
      }}
      onCloseSubmenus={path => setOpenPath(path)}
      onSelect={(path) => {
        menu_item_at_path(items, path)?.onSelect?.();
        onClose();
      }}
    />,
    document.body
  );
}
