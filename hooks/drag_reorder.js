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
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const handleProps = useCallback((index) => {
    return {
      onPointerDown(e) {
        if (e.button !== 0) return;
        const list = listRef.current;
        if (!list) return;
        e.preventDefault();
        const rowCount = list.children.length;
        const rowHeight = list.children[index]?.offsetHeight || 1;
        const startY = e.clientY;
        const handle = e.currentTarget;
        handle.setPointerCapture(e.pointerId);

        let latest = { from: index, to: index, dy: 0 };
        setDragging(latest);

        const onPointerMove = (ev) => {
          const dy = ev.clientY - startY;
          const to = clamp(index + Math.round(dy / rowHeight), 0, rowCount - 1);
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
      const rowHeight = listRef.current?.children[dragging.from]?.offsetHeight || 0;
      if (index === dragging.from) {
        return {
          transform: `translateY(${dragging.dy}px)`,
          zIndex: 2,
          position: /** @type {const} */ ('relative'),
          transition: 'none'
        };
      }
      if (dragging.to > dragging.from && index > dragging.from && index <= dragging.to) {
        return { transform: `translateY(${-rowHeight}px)`, transition: 'transform 120ms ease' };
      }
      if (dragging.to < dragging.from && index >= dragging.to && index < dragging.from) {
        return { transform: `translateY(${rowHeight}px)`, transition: 'transform 120ms ease' };
      }
      return { transition: 'transform 120ms ease' };
    },
    [dragging]
  );

  return { listRef, dragging, handleProps, itemStyle };
}
