import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { CloseIcon, LogoIcon } from './icons';
import { clamp } from '../utils/format';

interface ModalProps {
  title?: string;
  fullscreen?: boolean;
  onClose(): void;
  children: ReactNode;
}

export function Modal({ title = 'Xebrine', fullscreen = false, onClose, children }: ModalProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const posRef = useRef(pos);
  posRef.current = pos;
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (fullscreen || e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = posRef.current;
    const rect = modalRef.current?.getBoundingClientRect();
    const baseLeft = rect ? rect.left - startPos.x : 0;
    const baseTop = rect ? rect.top - startPos.y : 0;
    document.body.style.userSelect = 'none';
    const onMove = (ev: globalThis.PointerEvent) => {
      let x = startPos.x + (ev.clientX - startX);
      let y = startPos.y + (ev.clientY - startY);
      if (rect) {
        x = clamp(x, -baseLeft, window.innerWidth - rect.width - baseLeft);
        y = clamp(y, -baseTop, window.innerHeight - rect.height - baseTop);
      }
      setPos({ x, y });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      className={`xe_modal-overlay${fullscreen ? ' xe_modal-overlay--opaque' : ''}`}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className={`xe_modal${fullscreen ? ' xe_modal--fullscreen' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={fullscreen ? undefined : { transform: `translate(${pos.x}px, ${pos.y}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="xe_modal__header" onPointerDown={startDrag}>
          <h2 className="xe_modal__title">
            <LogoIcon size={14} />
            <span className="xe_modal__title-text">{title}</span>
          </h2>
          <button type="button" className="xe_icon-btn" onClick={onClose} title="Close">
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="xe_modal__body">{children}</div>
      </div>
    </div>
  );
}
