import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';
import { clamp } from '../utils/format';

interface ModalProps {
  title?: string;
  fullscreen?: boolean;
  wide?: boolean;
  onClose(): void;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const EXIT_DURATION_MS = 140;

export function Modal({ title = 'Xebrine', fullscreen = false, wide = false, onClose, children }: ModalProps) {
  const titleId = useId();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [closing, setClosing] = useState(false);
  const posRef = useRef(pos);
  const onCloseRef = useRef(onClose);
  const closingRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  posRef.current = pos;
  onCloseRef.current = onClose;
  const modalRef = useRef<HTMLDivElement | null>(null);

  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : EXIT_DURATION_MS;
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onCloseRef.current();
    }, delay);
  };

  useEffect(() => {
    const modal = modalRef.current;
    const restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (modal && !modal.contains(document.activeElement)) {
      (modal.querySelector<HTMLElement>(FOCUSABLE) ?? modal).focus();
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestClose();
        return;
      }
      if (event.key !== 'Tab' || !modal) return;
      const focusable = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      if (restoreFocus?.isConnected) restoreFocus.focus();
    };
  }, []);

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (fullscreen || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
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

  return createPortal(
    <div
      className={`xe_modal-overlay${fullscreen ? ' xe_modal-overlay--opaque' : ''}${
        closing ? ' xe_modal-overlay--closing' : ''
      }`}
      onClick={requestClose}
    >
      <div
        ref={modalRef}
        className={`xe_modal${fullscreen ? ' xe_modal--fullscreen' : ''}${wide ? ' xe_modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={
          fullscreen
            ? undefined
            : ({ '--xe_modal-x': `${pos.x}px`, '--xe_modal-y': `${pos.y}px` } as CSSProperties)
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="xe_modal__header" onPointerDown={startDrag}>
          <button type="button" className="xe_icon-btn" onClick={requestClose} title="Close" aria-label="Close">
            <CloseIcon size={18} />
          </button>
          <h2 id={titleId} className="xe_modal__title">{title}</h2>
        </div>
        <div className="xe_modal__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
