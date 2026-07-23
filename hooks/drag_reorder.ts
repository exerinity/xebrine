import { useCallback, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from 'react';
import { clamp } from '../utils/format';

interface DragState {
  from: number;
  to: number;
  dy: number;
}

interface DragReorder {
  listRef: RefObject<HTMLDivElement | null>;
  dragging: DragState | null;
  handleProps(index: number): { onPointerDown: (e: PointerEvent<HTMLElement>) => void };
  itemStyle(index: number): CSSProperties;
}

export function useDragReorder(onMove: (from: number, to: number) => void): DragReorder {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const handleProps = useCallback((index: number) => {
    return {
      onPointerDown(e: PointerEvent<HTMLElement>) {
        if (e.button !== 0) return;
        const list = listRef.current;
        if (!list) return;
        e.preventDefault();
        const rowCount = list.children.length;
        const rowHeight = (list.children[index] as HTMLElement | undefined)?.offsetHeight || 1;
        const startY = e.clientY;
        const handle = e.currentTarget;
        handle.setPointerCapture(e.pointerId);

        let latest: DragState = { from: index, to: index, dy: 0 };
        setDragging(latest);

        const onPointerMove = (ev: globalThis.PointerEvent) => {
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
    (index: number): CSSProperties => {
      if (!dragging) return {};
      const rowHeight =
        (listRef.current?.children[dragging.from] as HTMLElement | undefined)?.offsetHeight || 0;
      if (index === dragging.from) {
        return { transform: `translateY(${dragging.dy}px)`, zIndex: 2, position: 'relative', transition: 'none' };
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
