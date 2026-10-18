import { useState } from 'react';
import { useSettings } from '../../context/settings_context';
import { usePlayer } from '../../src/context/player';
import { toast, type ToastVariant } from '../../utils/toast';
import { speakText } from '../../utils/speech';
import { applyPronunciations } from '../../utils/pronunciation';
import { ExplicitIcon } from '../../components/explicit_badge';
import { Modal } from '../../components/modal';
import { PROFANITY_WORDS } from '../../utils/profanity';
import { Spinner } from '../../components/spinner';
import { ContextMenu, type ContextMenuItem } from '../../components/context_menu';

const TOAST_VARIANTS: ToastVariant[] = ['success', 'error', 'info', 'warning'];

function meows(depth: number): ContextMenuItem {
  if (depth === 0) return { label: 'Meow' };
  return { label: 'Meow', submenu: [meows(depth - 1)] };
}

const MEOW_ITEMS: ContextMenuItem[] = [
  { label: 'Meow' },
  { label: 'Meow' },
  { label: 'Meow' },
  meows(5)
];

export function ToysSettings({ show_heading }: { show_heading: boolean }) {
  const { settings, update } = useSettings();
  const { current } = usePlayer();
  const [toastVariant, setToastVariant] = useState<ToastVariant>('info');
  const [toastMessage, setToastMessage] = useState('');
  const [mmmeow, set_meow_menu] = useState<{ x: number; y: number } | null>(null);
  const [showFilteredWords, setShowFilteredWords] = useState(false);

  const createToast = () => {
    toast[toastVariant](toastMessage.trim() || `This is a ${toastVariant} toast`);
  };

  const announceCurrentSong = () => {
    if (current)
      speakText(
        applyPronunciations(
          `Now playing: ${current.track.title} by ${current.track.artist}`,
          settings.artistPronunciations
        )
      );
    else speakText('no');
  };

  return (
    <>
      {show_heading && <h2 className="xe_settings__category-heading">Toys</h2>}
      <section className="xe_settings__section">
        <h2>Create a toast notification</h2>
        <input
          type="text"
          className="xe_search-input"
          placeholder={`This is a ${toastVariant} toast`}
          value={toastMessage}
          onChange={(e) => setToastMessage(e.target.value)}
        />
        <div className="xe_settings__chip-row">
          {TOAST_VARIANTS.map((variant) => (
            <button
              key={variant}
              type="button"
              className={`xe_settings__chip xe_settings__chip--${variant}${variant === toastVariant ? ' xe_settings__chip--active' : ''}`}
              aria-pressed={variant === toastVariant}
              onClick={() => setToastVariant(variant)}
            >
              {variant}
            </button>
          ))}
        </div>
        <div className="xe_settings__actions">
          <button
            type="button"
            className={`xe_btn xe_btn--accent xe_btn--toast-${toastVariant}`}
            onClick={createToast}
          >
            Create toast
          </button>
        </div>
      </section>

      <section className="xe_settings__section">
        <h2>Announce currently playing song</h2>
        <div className="xe_settings__actions">
          <button type="button" className="xe_btn" onClick={announceCurrentSong}>
            Announce
          </button>
        </div>
      </section>
      <section className="xe_settings__section">
        <h2>Spinner that does nothing</h2>
        <Spinner></Spinner>
      </section>

      <section className="xe_settings__section">
        <h2>Context menu test</h2>
        <p className="xe_settings__hint">Right click this button:</p>
        <div className="xe_settings__actions">
          <button
            type="button"
            className="xe_btn"
            onContextMenu={(event) => {
              event.preventDefault();
              set_meow_menu({ x: event.clientX, y: event.clientY });
            }}
          >
            Meow?
          </button>
        </div>
        {mmmeow && (
          <ContextMenu
            x={mmmeow.x}
            y={mmmeow.y}
            items={MEOW_ITEMS}
            onClose={() => set_meow_menu(null)}
          />
        )}
      </section>

      <section className="xe_settings__section">
        <h2>Tag explicit songs?</h2>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.tagExplicitSongs}
            onChange={(e) => update({ tagExplicitSongs: e.target.checked })}
          />
          <span>
            Scan lyrics for profanity and mark profane songs with an <ExplicitIcon />
          </span>
        </label>
        <p className="xe_settings__hint">
          Runs whenever lyrics are found for a track (freshly fetched, imported, or already cached). Once a
          song is tagged, it stays tagged in this browser, even if the setting is later turned off.<br></br>
          <i>Note:</i> this is not automatic (you must initiate a lyrics search) and is pretty rudimentary{' '}
          <button type="button" className="xe_link-btn" onClick={() => setShowFilteredWords(true)}>
            (show words to filter)
          </button>
        </p>
        {showFilteredWords && (
          <Modal title="Filtered words" onClose={() => setShowFilteredWords(false)}>
            <div className="xe_settings__chip-row">
              {PROFANITY_WORDS.map((word) => (
                <span key={word}>
                  {word}
                </span>
              ))}
            </div>
          </Modal>
        )}
      </section>
    </>
  );
}
