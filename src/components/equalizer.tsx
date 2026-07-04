import { useSettings } from '../context/settings_context';
import {
  EQ_BANDS,
  EQ_MIN,
  EQ_MAX,
  EQ_FLAT,
  EQ_PRESETS,
  matchPreset,
  formatBandFreq,
  normalizeBands
} from '../audio/eq';

export function Equalizer() {
  const { settings, update } = useSettings();
  const bands = normalizeBands(settings.eqBands);
  const preset = matchPreset(bands);

  const setBand = (index: number, value: number) => {
    const next = bands.slice();
    next[index] = value;
    update({ eqBands: next });
  };

  const applyPreset = (name: string) => {
    if (name === 'Flat') {
      update({ eqBands: [...EQ_FLAT] });
    } else if (EQ_PRESETS[name]) {
      update({ eqBands: [...EQ_PRESETS[name]], eqEnabled: true });
    }
  };

  return (
    <section className="xe_settings__section">
      <h2>Equalizer</h2>
      <label className="xe_settings__radio">
        <input
          type="checkbox"
          checked={settings.eqEnabled}
          onChange={(e) => update({ eqEnabled: e.target.checked })}
        />
        <span>Enabled</span>
      </label>

      <div className="xe_eq__controls">
        <label className="xe_eq__preset">
          <span>Preset</span>
          <select
            className="xe_eq__select"
            value={preset ?? 'Custom'}
            onChange={(e) => applyPreset(e.target.value)}
          >
            {preset === null && (
              <option value="Custom" disabled>
                Custom
              </option>
            )}
            <option value="Flat">Flat</option>
            {Object.keys(EQ_PRESETS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="xe_btn xe_btn--small xe_btn--quiet"
          onClick={() => applyPreset('Flat')}
        >
          Reset
        </button>
      </div>

      <div className={`xe_eq__bands${settings.eqEnabled ? '' : ' xe_eq__bands--off'}`}>
        {EQ_BANDS.map((freq, i) => (
          <div className="xe_eq__band" key={freq}>
            <span className="xe_eq__gain">{bands[i] > 0 ? `+${bands[i]}` : bands[i]}</span>
            <input
              type="range"
              className="xe_eq__slider"
              min={EQ_MIN}
              max={EQ_MAX}
              step={1}
              value={bands[i]}
              onChange={(e) => setBand(i, Number(e.target.value))}
              aria-label={`${formatBandFreq(freq)} Hz band gain`}
              title={`${freq} Hz`}
            />
            <span className="xe_eq__freq">{formatBandFreq(freq)}</span>
          </div>
        ))}
      </div>
      <p className="xe_settings__hint" style={{ fontStyle: 'italic' }}>
        You should probably lower your volume when using presets
      </p>
    </section>
  );
}
