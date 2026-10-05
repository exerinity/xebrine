import { useCallback, useRef, useState } from 'react';
import { clamp } from '../utils/format';

/**
 * @typedef {Object} DragState
 * @property {number} from
 * @property {number} to
 * @property {number} dy
 */

/**
 * @param {(from: number, to: number) => void} onMove
 */
export function useDragReorder(onMove) {
  const listRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [dragging, setDragging] = /** @type {[DragState | null, (v: DragState | null) => void]} */ (
    useState(null)
  );
  const didDragRef = useRef(false);
  const draggedSizeRef = useRef({ height: 0, gap: 0 });
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const handleProps = useCallback((index) => {
    return {
      onPointerDown(e) {
        if (e.button !== 0) return;
        const list = listRef.current;
        if (!list) return;
        e.preventDefault();
        const items = Array.from(list.children);
        const item = items[index];
        if (!(item instanceof HTMLElement)) return;
        const itemRects = items.map((child) => child.getBoundingClientRect());
        const itemRect = itemRects[index];
        const listRect = list.getBoundingClientRect();
        const gap = Number.parseFloat(getComputedStyle(list).rowGap) || 0;
        const startY = e.clientY;
        const handle = e.currentTarget;
        handle.setPointerCapture(e.pointerId);
        didDragRef.current = false;
        draggedSizeRef.current = { height: itemRect.height, gap };

        let latest = { from: index, to: index, dy: 0 };
        setDragging(latest);

        const onPointerMove = (ev) => {
          const dy = clamp(
            ev.clientY - startY,
            listRect.top - itemRect.top,
            listRect.bottom - itemRect.bottom
          );
          if (Math.abs(dy) > 3) didDragRef.current = true;
          const top = itemRect.top + dy;
          let to = index;
          let nearest = Math.abs(dy);
          for (let next = 0; next < itemRects.length; next += 1) {
            if (next === index) continue;
            const rect = itemRects[next];
            const slotTop = next < index ? rect.top : rect.bottom - itemRect.height;
            const distance = Math.abs(top - slotTop);
            if (distance < nearest) {
              nearest = distance;
              to = next;
            }
          }
          latest = { from: index, to, dy };
          setDragging(latest);
        };
        const onPointerUp = () => {
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerUp);
          setDragging(null);
          if (latest.to !== latest.from) onMoveRef.current(latest.from, latest.to);
        };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
      }
    };
  }, []);

  const itemStyle = useCallback(
    /** @returns {import('react').CSSProperties} */
    (index) => {
      if (!dragging) return {};
      const distance = draggedSizeRef.current.height + draggedSizeRef.current.gap;
      if (index === dragging.from) {
        return {
          transform: `translateY(${dragging.dy}px)`,
          zIndex: 2,
          position: /** @type {const} */ ('relative'),
          transition: 'none'
        };
      }
      if (dragging.to > dragging.from && index > dragging.from && index <= dragging.to) {
        return { transform: `translateY(${-distance}px)`, transition: 'transform 120ms ease' };
      }
      if (dragging.to < dragging.from && index >= dragging.to && index < dragging.from) {
        return { transform: `translateY(${distance}px)`, transition: 'transform 120ms ease' };
      }
      return { transition: 'transform 120ms ease' };
    },
    [dragging]
  );

  return { listRef, dragging, handleProps, itemStyle, didDragRef };
}
