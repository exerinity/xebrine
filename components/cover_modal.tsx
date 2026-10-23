import { useEffect, useRef, useState } from 'react';
import { CloseIcon, CopyIcon, DownloadIcon } from './icons';
import { toast } from '../utils/toast';
import { useSettings } from '../context/settings_context';
import { useCoverDeformation } from '../hooks/cover_deformation';

interface CoverModalProps {
  src: string;
  alt?: string;
  onClose(): void;
}

const EXIT_DURATION_MS = 140;

export function CoverModal({ src, alt = '', onClose }: CoverModalProps) {
  const { settings } = useSettings();
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const closeTimerRef = useRef<number | null>(null);
  const cover_ref = useRef<HTMLButtonElement | null>(null);
  const cover_handlers = useCoverDeformation(
    cover_ref,
    settings.reducedMotion,
    () => window.open(src, '_blank', 'noopener,noreferrer')
  );
  onCloseRef.current = onClose;

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
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const coverAsPng = async () => {
    const response = await fetch(src);
    const blob = await response.blob();
    if (blob.type === 'image/png') return blob;

    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.drawImage(bitmap, 0, 0);
    bitmap.close();

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('Could not convert cover'))), 'image/png');
    });
  };

  const copyCover = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': coverAsPng() })]);
      toast.success('The cover image has been copied to your clipboard');
    } catch {
      toast.error("Couldn't copy the cover");
    }
  };

  const saveCover = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const extension =
        ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[
          blob.type
        ] ?? 'png';
      const filename = (alt || 'album cover').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'album cover';
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${filename}.${extension}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't save the cover");
    }
  };

  return (
    <div
      className={`xe_cover-modal${closing ? ' xe_cover-modal--closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Enlarged cover"
      onClick={requestClose}
    >
      <button
        type="button"
        className="xe_cover-modal__close"
        onClick={requestClose}
        title="Close"
        aria-label="Close"
      >
        <CloseIcon size={20} />
      </button>
      <div className="xe_cover-modal__content" onClick={(event) => event.stopPropagation()}>
        <button
          ref={cover_ref}
          type="button"
          className="xe_cover-modal__link"
          {...cover_handlers}
          title="Open image, drag to deform"
          aria-label="Open image, drag to deform"
        >
          <img src={src} alt={alt} className="xe_cover-modal__image" draggable={false} />
        </button>
        <div className="xe_cover-modal__actions">
          <button type="button" className="xe_btn xe_cover-modal__action" onClick={() => void copyCover()}>
            <CopyIcon size={15} />
            Copy
          </button>
          <button type="button" className="xe_btn xe_cover-modal__action" onClick={() => void saveCover()}>
            <DownloadIcon size={15} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
