import { useEffect, type MouseEvent } from 'react';
import { CloseIcon, CopyIcon, DownloadIcon } from './icons';
import { toast } from '../utils/toast';

interface CoverModalProps {
  src: string;
  alt?: string;
  onClose(): void;
}

export function CoverModal({ src, alt = '', onClose }: CoverModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tiltCover = (event: MouseEvent<HTMLAnchorElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;

    event.currentTarget.style.setProperty('--cover-rotate-x', `${(y - 0.5) * 10}deg`);
    event.currentTarget.style.setProperty('--cover-rotate-y', `${(0.5 - x) * 10}deg`);
    event.currentTarget.style.setProperty('--cover-shine-x', `${x * 100}%`);
    event.currentTarget.style.setProperty('--cover-shine-y', `${y * 100}%`);
  };

  const resetCoverTilt = (event: MouseEvent<HTMLAnchorElement>) => {
    event.currentTarget.style.setProperty('--cover-rotate-x', '0deg');
    event.currentTarget.style.setProperty('--cover-rotate-y', '0deg');
    event.currentTarget.style.setProperty('--cover-shine-x', '50%');
    event.currentTarget.style.setProperty('--cover-shine-y', '18%');
  };

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
      toast.success('Copied cover');
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
      className="xe_cover-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Enlarged cover"
      onClick={onClose}
    >
      <button type="button" className="xe_cover-modal__close" onClick={onClose} title="Close">
        <CloseIcon size={20} />
      </button>
      <div className="xe_cover-modal__content" onClick={(event) => event.stopPropagation()}>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="xe_cover-modal__link"
          onMouseMove={tiltCover}
          onMouseLeave={resetCoverTilt}
          title="Open original image"
        >
          <img src={src} alt={alt} className="xe_cover-modal__image" />
        </a>
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
