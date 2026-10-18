import { useSettings } from '../../context/settings_context';
import { Slider } from '../../components/slider';
import { AUTO_PLAY_LABELS, isAutoPlayLevel } from '../../queue/auto_play';
import { Equalizer } from '../../components/equalizer';

export function PlaybackSettings({ show_heading }: { show_heading: boolean }) {
  const { settings, update } = useSettings();

  return (
    <>
      {show_heading && <h2 className="xe_settings__category-heading">Playback settings</h2>}
      <section className="xe_settings__section">
        <h2>Auto play</h2>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.autoPlay}
            onChange={(e) => update({ autoPlay: e.target.checked })}
          />
          <span>
            <strong>Play random songs back-to-back</strong>
            <br />
            When all enqueued songs finish, Xebrine will pick completely random songs continuously
          </span>
        </label>
        <div className="xe_settings__slider-row">
          <Slider
            value={settings.autoPlayLevel}
            min={1}
            max={4}
            wheelStep={1}
            resetTo={1}
            disabled={!settings.autoPlay}
            onChange={(v) => {
              const level = Math.round(v);
              if (isAutoPlayLevel(level)) update({ autoPlayLevel: level });
            }}
            ariaLabel="Auto play selection"
          />
          <span
            className="xe_settings__slider-value xe_settings__slider-value--label"
            title={AUTO_PLAY_LABELS[settings.autoPlayLevel]}
          >
            {AUTO_PLAY_LABELS[settings.autoPlayLevel]}
          </span>
        </div>
        <p className="xe_settings__hint">
          <strong>Anything</strong> picks... anything<br></br>
          <strong>Same artist</strong> stays with the artist that just finished<br></br>
          <strong>Artist + length</strong> does both above and below<br></br>
          <strong>Similar length</strong> tries to keep the next track within 20% of the previous track's running time, but no guarantees
        </p>
      </section>

      <section className="xe_settings__section">
        <h2>Auto mix</h2>
        <p className="xe_settings__hint">
          Auto mix is an experimental automatic mixing subsystem. It works by analyzing the BPM of the currently playing track and the next enqueued track then calculates the BPM difference and ease of crossfading while beat-matching
        </p>
        <details className="xe_settings__details">
          <summary>Read me...</summary>
          <div className="xe_settings__details-content">
            <p className="xe_settings__hint">
              This is <strong>extremely</strong> broken and will not work for most tracks. If you just queue every song on your drive expecting smooth transitions, you'll not get that.
              I tuned this (and am still vigorously tuning it) basically for very long progressive house tracks like deadmau5 (especially the At Play series), with super long 128 bpm intro and outros. This feature is <strong>incompatible</strong> for pretty much any other kind of music.
            </p>
            <p className="xe_settings__hint">
              You may notice skips or gaps between or during mixing. This is expected as - by normal, Xebrine uses - and attempts to cleanly transition playback from - a traditional HTML5 audio element to play music. However, during mixing, Xebrine uses the Web Audio API to process the audio and crossfade it. I've made efforts to mitigate / eliminate that gap, but you may still notice it.
            </p>
            <p className="xe_settings__hint">
              If you notice that during mixing, the next track sounds slowed down or sped up, that's... because it is. Xebrine will attempt to match the BPM of the next track to the current track, and if the next track is too far off in BPM, it will be sped up or slowed down to match. This is also expected and intended - I don't really have any better solutions yet.
            </p>
            <p className="xe_settings__hint">
              Xebrine uses a completely homegrown BPM detection algorithm I wrote myself. No
              libraries, not even for the FFT. It runs in a Web Worker so it never chokes the
              UI, and caches the last 40 tracks. The track gets decoded to mono, cut into
              overlapping frames and turned into an onset curve - how much energy is
              <em> appearing</em> at each moment, with the bass weighted up because kick drums
              are what you actually beat-match to. Autocorrelating that curve against a comb
              filter finds the tempo, then a dynamic programming pass finds where the beats
              actually land, and a line fitted through those beats gives the final BPM and tells
              Xebrine exactly when the next beat arrives.
            </p>
            <p className="xe_settings__hint">
              The confidence percentage combines how far the winning tempo stood out, how many
              parts of the track agreed on it, and how tightly the beats hug the fitted grid. A
              low reading usually means the algorithm suspects it landed on the wrong octave -
              half-time hip hop reading as 170, drum and bass reading as 87. No algorithm is perfect, and this certainly isn't an exception.
            </p>
            <p className="xe_settings__hint">
              There is still a lot to do, at the forefront; key and harmonic mixing. Because, many songs can be 128 bpm but be wildly different and an auto mix betwen those would sound like a walkie-talkie explosion. Like, Yelawolf's "Till It's Gone" is 129 bpm but Martin Garrix's "Proxy" is 128, but they are probably the last songs you'd try mixing.
            </p>
          </div>
        </details>
        <h2>How long should a crossfade be?</h2>
        <div className="xe_settings__slider-row">
          <Slider
            value={settings.autoMixDuration}
            min={5}
            max={90}
            wheelStep={1}
            resetTo={15}
            onChange={(v) => update({ autoMixDuration: Math.round(v) })}
            ariaLabel="Auto mix duration"
          />
          <span className="xe_settings__slider-value">{settings.autoMixDuration}s</span>
        </div>
        <p className="xe_settings__hint">
          A <span style={{ color: '#3ddc84' }}>Green</span> pill means the current and next track BPMs are compatible for a mix and should work well
          <br></br>
          An <span style={{ color: '#f5a623' }}>Orange</span> pill means the BPMs are less-than-optimal but Xebrine will try mixing them anyway
          <br></br>
          A <span style={{ color: '#f5524a' }}>Red</span> pill means the BPMs are too out-of-range for mixing and they will just simply crossfade without processing
        </p>
      </section>

      <Equalizer />
    </>
  );
}
