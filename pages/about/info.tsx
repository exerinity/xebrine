import { useState } from 'react';
import { LogoIcon } from '../../components/icons';
import { electronVersion, isElectron } from '../../utils/electron';
import { LATEST_VERSION } from '../release_notes';

export function AboutInfo() {
  const [spinning, set_spinning] = useState(false);

  return (
    <>
      <div className="xe_about__hero">
        <span
          className={`xe_about__logo${spinning ? ' xe_about__logo--spin' : ''}`}
          onClick={() => set_spinning(true)}
          onAnimationEnd={() => set_spinning(false)}
        >
          <LogoIcon size={60} />
        </span>
        <div>
          <h2 className="xe_about__name">Xebrine {LATEST_VERSION}</h2>
          {isElectron && (
            <p className="xe_about__version">
              You are running Xebrine in its Electron wrapper (electron v{electronVersion()})
            </p>
          )}
        </div>
      </div>

      <p className="xe_about__lead">
        <strong>Xebrine</strong> (pronounced <i>"zeh-brine"</i>) is a utillitarian heavy-duty,
        highly customizable, power-user desktop-focused PWA music player app designed for large
        music collections and very long listening sessions. Made in React with a minimal amount
        of dependencies by <a href="https://exerinity.com" target="_blank">exerinity</a>, it is
        the non-replacing spiritual-successor to the venerable{' '}
        <a href="https://voxity.dev" target="_blank" rel="noopener noreferrer">Voxity</a>, a
        music player PWA written in vanilla JavaScript.
      </p>

      <p className="xe_about__lead">
        Xebrine was released a year after Voxity was created. The key difference between the two
        is Voxity is the uglier, no-nonsense utillitarian player; Xebrine is the prettied-up,
        more feature-rich, and more friendly "experienceful" player. However, both are
        undoubtedly utilitarian and power-user focused...
      </p>
    </>
  );
}
