import { useState } from 'react';
import { useSettings } from '../../context/settings_context';
import { speakText } from '../../utils/speech';
import { PlayIcon, TrashIcon } from '../../components/icons';

export function AccessibilitySettings({ show_heading }: { show_heading: boolean }) {
  const { settings, update } = useSettings();
  const [pronArtist, setPronArtist] = useState('');
  const [pronSay, setPronSay] = useState('');

  const addPronunciation = () => {
    const artist = pronArtist.trim();
    const pronunciation = pronSay.trim();
    if (!artist || !pronunciation) return;
    const rest = settings.artistPronunciations.filter(
      (p) => p.artist.toLowerCase() !== artist.toLowerCase()
    );
    update({ artistPronunciations: [...rest, { artist, pronunciation }] });
    setPronArtist('');
    setPronSay('');
  };

  const removePronunciation = (artist: string) => {
    update({
      artistPronunciations: settings.artistPronunciations.filter((p) => p.artist !== artist)
    });
  };

  return (
    <>
      {show_heading && <h2 className="xe_settings__category-heading">Accessibility</h2>}
      <section className="xe_settings__section">
        <h2>Motion</h2>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(e) => update({ reducedMotion: e.target.checked })}
          />
          <span>Reduced motion</span>
        </label>
      </section>

      <section className="xe_settings__section">
        <h2>Speech</h2>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.announceTrackChanges}
            onChange={(e) => update({ announceTrackChanges: e.target.checked })}
          />
          <span>Announce when a song is finished or changes over TTS</span>
        </label>
      </section>

      <section className="xe_settings__section">
        <h2>Artist pronunciation</h2>
        <div className="xe_settings__pron-row">
          <input
            type="text"
            className="xe_search-input"
            placeholder="Who? (e.g. deadmau5)"
            value={pronArtist}
            onChange={(e) => setPronArtist(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPronunciation()}
          />
          <input
            type="text"
            className="xe_search-input"
            placeholder="Pronounce as? (e.g. dead mouse)"
            value={pronSay}
            onChange={(e) => setPronSay(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPronunciation()}
          />
          <button
            type="button"
            className="xe_btn xe_btn--accent"
            onClick={addPronunciation}
            disabled={!pronArtist.trim() || !pronSay.trim()}
          >
            Add
          </button>
        </div>
        {settings.artistPronunciations.length > 0 && (
          <ul className="xe_settings__folders">
            {settings.artistPronunciations.map((p) => (
              <li key={p.artist}>
                <div className="xe_settings__folder-info">
                  <span className="xe_settings__folder-name">{p.artist}</span>
                  <span className="xe_settings__folder-count">as <i>{p.pronunciation}</i></span>
                </div>
                <div className="xe_settings__folder-actions">
                  <button
                    type="button"
                    className="xe_btn xe_btn--accent"
                    onClick={() => speakText(p.pronunciation)}
                    aria-label={`Play pronunciation for ${p.artist}`}
                  >
                    <PlayIcon size={14} />
                    Test
                  </button>
                  <button
                    type="button"
                    className="xe_btn xe_settings__folder-remove"
                    onClick={() => removePronunciation(p.artist)}
                    aria-label={`Remove pronunciation for ${p.artist}`}
                  >
                    <TrashIcon size={14} />
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
