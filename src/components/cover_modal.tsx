import { useEffect } from 'react';
import { CloseIcon } from './icons';

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
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="xe_cover-modal__link"
        onClick={(e) => e.stopPropagation()}
        title="Open original image"
      >
        <img src={src} alt={alt} className="xe_cover-modal__image" />
      </a>
    </div>
  );
}
