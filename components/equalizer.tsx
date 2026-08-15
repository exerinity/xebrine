import { useSettings } from '../context/settings_context';
import { Slider } from './slider';
import {
  EQ_BANDS,
  EQ_MIN,
  EQ_MAX,
  EQ_FLAT,
  EQ_PRESETS,
  EQ_PREAMP_MIN,
  EQ_PREAMP_MAX,
  EQ_PREAMP_DEFAULT,
  EQ_INTENSITY_DEFAULT,
  eq_peak_gain_db,
  format_db,
  match_preset,
  format_band_frequency,
  normalize_bands,
  normalize_intensity,
  normalize_preamp,
  suggested_preamp
} from '../audio/eq';

export function Equalizer() {
  const { settings, update } = useSettings();
  const bands = normalize_bands(settings.eqBands);
  const preamp = normalize_preamp(settings.eqPreamp);
  const intensity = normalize_intensity(settings.eqIntensity);
  const preset = match_preset(bands);

  const peak = eq_peak_gain_db(bands, intensity);
  const headroom = peak + preamp;
  const suggested = suggested_preamp(bands, intensity);
  const hot = headroom > 0.05;

  const setBand = (index: number, value: number) => {
    const next = bands.slice();
    next[index] = value;
    update({ eqBands: next });
  };

  const applyPreset = (name: string) => {
    if (name === 'Flat') {
      update({ eqBands: [...EQ_FLAT], eqPreamp: EQ_PREAMP_DEFAULT });
    } else if (EQ_PRESETS[name]) {
      const next = [...EQ_PRESETS[name]];
      update({ eqBands: next, eqPreamp: suggested_preamp(next, intensity), eqEnabled: true });
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

      <div className={`xe_eq__levels${settings.eqEnabled ? '' : ' xe_eq__levels--off'}`}>
        <div className="xe_eq__level">
          <span className="xe_eq__level-label">Preamp</span>
          <div className="xe_settings__slider-row">
            <Slider
              value={preamp}
              min={EQ_PREAMP_MIN}
              max={EQ_PREAMP_MAX}
              wheelStep={0.5}
              markAt={0}
              resetTo={EQ_PREAMP_DEFAULT}
              onChange={(v) => update({ eqPreamp: Math.round(v * 2) / 2 })}
              ariaLabel="Equalizer preamp"
            />
            <span className="xe_settings__slider-value">{format_db(preamp)} dB</span>
          </div>
        </div>
        <div className="xe_eq__level">
          <span className="xe_eq__level-label">Intensity</span>
          <div className="xe_settings__slider-row">
            <Slider
              value={intensity}
              min={0}
              max={1}
              wheelStep={0.05}
              resetTo={EQ_INTENSITY_DEFAULT}
              onChange={(v) => update({ eqIntensity: Math.round(v * 100) / 100 })}
              ariaLabel="Equalizer intensity"
            />
            <span className="xe_settings__slider-value">{Math.round(intensity * 100)}%</span>
          </div>
        </div>
      </div>

      <div className="xe_eq__headroom">
        <span className={`xe_eq__headroom-value${hot ? ' xe_eq__headroom-value--hot' : ''}`}>
          Peak output {format_db(headroom)} dB
        </span>
        <button
          type="button"
          className="xe_btn xe_btn--small xe_btn--quiet"
          disabled={preamp === suggested}
          onClick={() => update({ eqPreamp: suggested })}
        >
          Auto preamp
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
              aria-label={`${format_band_frequency(freq)} Hz band gain`}
              title={`${freq} Hz`}
            />
            <span className="xe_eq__freq">{format_band_frequency(freq)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
