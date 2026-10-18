import { useSettings } from '../../context/settings_context';
import { Slider } from '../../components/slider';
import { THEMES } from '../../utils/themes';
import { KEN_BURNS_DEFAULT_INTENSITY, KEN_BURNS_MAX_INTENSITY, KEN_BURNS_MIN_INTENSITY } from '../../hooks/ken_burns';

const FS_BG_PRESETS: { label: string; blur: number; saturate: number }[] = [
  { label: 'None', blur: 0, saturate: 1 },
  { label: 'Cinematic', blur: 56, saturate: 1.35 },
  { label: 'Vague', blur: 32, saturate: 1.1 },
  { label: 'Dramatic', blur: 80, saturate: 1.9 },
  { label: 'Maximum', blur: 120, saturate: 3 }
];

export function AppearanceSettings({ show_heading }: { show_heading: boolean }) {
  const { settings, update } = useSettings();

  return (
    <>
      {show_heading && <h2 className="xe_settings__category-heading">Appearance</h2>}
      <section className="xe_settings__section">
        <h2>Theme</h2>
        <div className="xe_settings__chip-row">
          {THEMES.map((themeOption) => {
            const activeTheme = settings.theme === themeOption.id;
            return (
              <button
                key={themeOption.id}
                type="button"
                className={`xe_theme-swatch${activeTheme ? ' xe_theme-swatch--active' : ''}${themeOption.id === 'adaptive' ? ' xe_theme-swatch--adaptive' : ''
                  }`}
                aria-pressed={activeTheme}
                onClick={() => update({ theme: themeOption.id })}
              >
                <span
                  className="xe_theme-swatch__dot"
                  style={{
                    background: `linear-gradient(135deg, ${themeOption.swatch[0]} 50%, ${themeOption.swatch[1]} 50%)`,
                    borderColor: themeOption.swatch[2]
                  }}
                />
                {themeOption.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="xe_settings__section">
        <h2>Page background</h2>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.showBackgroundIcon}
            onChange={(e) => update({ showBackgroundIcon: e.target.checked })}
          />
          <span>Show background icon</span>
        </label>
      </section>

      <section className="xe_settings__section">
        <h2>Player bar position</h2>
        <label className="xe_settings__radio">
          <input
            type="radio"
            name="player-bar-position"
            checked={settings.playerBarPosition === 'bottom'}
            onChange={() => update({ playerBarPosition: 'bottom' })}
          />
          <span>Bottom</span>
        </label>
        <label className="xe_settings__radio">
          <input
            type="radio"
            name="player-bar-position"
            checked={settings.playerBarPosition === 'top'}
            onChange={() => update({ playerBarPosition: 'top' })}
          />
          <span>Top</span>
        </label>
      </section>

      <section className="xe_settings__section">
        <h2>The slider should go...</h2>
        <label className="xe_settings__radio">
          <input
            type="radio"
            name="player-bar-slider-position"
            checked={settings.playerBarSliderPosition === 'above'}
            onChange={() => update({ playerBarSliderPosition: 'above' })}
          />
          <span>Above the controls</span>
        </label>
        <label className="xe_settings__radio">
          <input
            type="radio"
            name="player-bar-slider-position"
            checked={settings.playerBarSliderPosition === 'below'}
            onChange={() => update({ playerBarSliderPosition: 'below' })}
          />
          <span>Below the controls</span>
        </label>
      </section>

      <section className="xe_settings__section">
        <h2>Player bar layout</h2>
        <label className="xe_settings__radio">
          <input
            type="radio"
            name="player-bar-layout"
            checked={settings.playerBarLayout === 'comfortable'}
            onChange={() => update({ playerBarLayout: 'comfortable' })}
          />
          <span>Comfortable</span>
        </label>
        <label className="xe_settings__radio">
          <input
            type="radio"
            name="player-bar-layout"
            checked={settings.playerBarLayout === 'compact'}
            onChange={() => update({ playerBarLayout: 'compact' })}
          />
          <span>Compact</span>
        </label>
      </section>

      <section className="xe_settings__section">
        <h2>Fullscreen player style</h2>
        <label className="xe_settings__radio">
          <input
            type="radio"
            name="fullscreen-player-style"
            checked={settings.fsPlayerStyle === 'maximal'}
            onChange={() => update({ fsPlayerStyle: 'maximal' })}
          />
          <span><strong>Maximal</strong> shows artwork, lyrics, queue, just played, and auto mix</span>
        </label>
        <label className="xe_settings__radio">
          <input
            type="radio"
            name="fullscreen-player-style"
            checked={settings.fsPlayerStyle === 'minimal'}
            onChange={() => update({ fsPlayerStyle: 'minimal' })}
          />
          <span><strong>Minimal</strong> just the artwork and lyrics</span>
        </label>
      </section>

      <section className="xe_settings__section">
        <h2>Maximal fullscreen player background</h2>
        <p className="xe_settings__hint">Right-click a slider to reset it to default</p>
        <div className="xe_settings__chip-row">
          {FS_BG_PRESETS.map((preset) => {
            const activePreset = settings.fsBlur === preset.blur && settings.fsSaturate === preset.saturate;
            return (
              <button
                key={preset.label}
                type="button"
                className={`xe_settings__chip${activePreset ? ' xe_settings__chip--active' : ''}`}
                aria-pressed={activePreset}
                onClick={() => update({ fsBlur: preset.blur, fsSaturate: preset.saturate })}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <h2>Blur</h2>
        <div className="xe_settings__slider-row">
          <Slider value={settings.fsBlur} min={0} max={120} wheelStep={1} resetTo={56} onChange={(v) => update({ fsBlur: Math.round(v) })} ariaLabel="Maximal fullscreen player background blur" />
          <span className="xe_settings__slider-value">{settings.fsBlur}px</span>
        </div>
        <h2>Saturation</h2>
        <div className="xe_settings__slider-row">
          <Slider value={settings.fsSaturate} min={0} max={3} wheelStep={0.05} resetTo={1.35} onChange={(v) => update({ fsSaturate: Math.round(v * 100) / 100 })} ariaLabel="Maximal fullscreen player background saturation" />
          <span className="xe_settings__slider-value">{settings.fsSaturate.toFixed(2)}x</span>
        </div>
        <h2>Ken Burns</h2>
        <label className="xe_settings__radio">
          <input type="checkbox" checked={settings.fsKenBurns} onChange={(e) => update({ fsKenBurns: e.target.checked })} />
          <span>Slowly zoom and pan the background</span>
        </label>
        {settings.fsKenBurns && (
          <div className="xe_settings__slider-row">
            <Slider value={settings.fsKenBurnsIntensity} min={KEN_BURNS_MIN_INTENSITY} max={KEN_BURNS_MAX_INTENSITY} wheelStep={0.1} resetTo={KEN_BURNS_DEFAULT_INTENSITY} onChange={(v) => update({ fsKenBurnsIntensity: Math.round(v * 10) / 10 })} ariaLabel="Ken Burns speed" />
            <span className="xe_settings__slider-value">{settings.fsKenBurnsIntensity.toFixed(1)}x</span>
          </div>
        )}
        <p className="xe_settings__hint">{settings.reducedMotion ? 'Reduced motion is on...' : 'Higher is faster'}</p>
      </section>

      <section className="xe_settings__section">
        <h2>Minimal fullscreen player background</h2>
        <p className="xe_settings__hint">Right-click a slider to reset it to default</p>
        <h2>Blur</h2>
        <div className="xe_settings__slider-row">
          <Slider value={settings.fsMinimalBlur} min={0} max={120} wheelStep={1} resetTo={80} onChange={(v) => update({ fsMinimalBlur: Math.round(v) })} ariaLabel="Minimal fullscreen player background blur" />
          <span className="xe_settings__slider-value">{settings.fsMinimalBlur}px</span>
        </div>
        <h2>Rotation speed</h2>
        <div className="xe_settings__slider-row">
          <Slider value={settings.fsMinimalRotationSpeed} min={0} max={4} wheelStep={0.1} resetTo={1} onChange={(v) => update({ fsMinimalRotationSpeed: Math.round(v * 10) / 10 })} ariaLabel="Minimal fullscreen player background rotation speed" />
          <span className="xe_settings__slider-value">{settings.fsMinimalRotationSpeed === 0 ? 'Off' : `${settings.fsMinimalRotationSpeed.toFixed(1)}x`}</span>
        </div>
        <p className="xe_settings__hint">{settings.reducedMotion ? 'Reduced motion is on...' : '1x is one rotation every 220 seconds'}</p>
      </section>
    </>
  );
}
