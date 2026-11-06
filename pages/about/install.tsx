// This page fucking sucks but who cares lmao

import { DownloadIcon } from '../../components/icons';
import { isElectron } from '../../utils/electron';
import { use_pwa_install } from '../../utils/pwa_install';

const APPIMAGE = 'https://espresso.exerinity.com/xebr/Xebrine-2.0.0.AppImage';
const RPM64 = 'https://espresso.exerinity.com/xebr/xebrine-desktop-2.0.0.x86_64.rpm';
const DEB64 = 'https://espresso.exerinity.com/xebr/xebrine-desktop_2.0.0_amd64.deb';
const WINDOWS_SHIT = {
  setup: 'https://espresso.exerinity.com/xebr/Xebrine%20Setup%202.0.0.exe',
  port: 'https://espresso.exerinity.com/xebr/Xebrine%202.0.0.exe'
};

export function AboutInstall() {
  const pwa = use_pwa_install();
  return (
    <section className="xe_about__download-section">
      <h3 className="xe_about__heading">Electron wrapper</h3>
      <p className="xe_about__text">
        The Electron wrapper gives Xebrine a dedicated multithreaded filesystem scanner and
        MPRIS support for Linux, ie, volume, shuffle, repeat controls that the browser normally
        wouldn't. It is <strong>NOT REQUIRED</strong> to use Xebrine nor really even recommended unless you really like MPRIS controls... otherwise just install Xebrine as a PWA
      </p>
      <h4 className="xe_about__subheading">Linux</h4>
      <div className="xe_about__downloads">
        <div className="xe_about__download-item">
          <span className="xe_about__download-icon">
            <DownloadIcon size={18} />
          </span>
          <div className="xe_about__download-details">
            <strong>AppImage</strong>
          </div>
          <a className="xe_btn xe_btn--accent xe_btn--small" href={APPIMAGE}>
            <DownloadIcon size={14} />
            Download
          </a>
        </div>
        <div className="xe_about__download-item">
          <span className="xe_about__download-icon">
            <DownloadIcon size={18} />
          </span>
          <div className="xe_about__download-details">
            <strong>.rpm (64-bit)</strong>
          </div>
          <a className="xe_btn xe_btn--accent xe_btn--small" href={RPM64}>
            <DownloadIcon size={14} />
            Download
          </a>
        </div>
        <div className="xe_about__download-item">
          <span className="xe_about__download-icon">
            <DownloadIcon size={18} />
          </span>
          <div className="xe_about__download-details">
            <strong>.deb (64-bit)</strong>
          </div>
          <a className="xe_btn xe_btn--accent xe_btn--small" href={DEB64}>
            <DownloadIcon size={14} />
            Download
          </a>
        </div>
      </div>
      <h4 className="xe_about__subheading">Windows</h4>
      <p className="xe_about__text">The Windows versions are experimental and might not work:</p>
      <div className="xe_about__downloads">
        <div className="xe_about__download-item">
          <span className="xe_about__download-icon">
            <DownloadIcon size={18} />
          </span>
          <div className="xe_about__download-details">
            <strong>Portable</strong>
          </div>
          <a className="xe_btn xe_btn--accent xe_btn--small" href={WINDOWS_SHIT.port}>
            <DownloadIcon size={14} />
            Download
          </a>
        </div>
        <div className="xe_about__download-item">
          <span className="xe_about__download-icon">
            <DownloadIcon size={18} />
          </span>
          <div className="xe_about__download-details">
            <strong>Setup</strong>
          </div>
          <a className="xe_btn xe_btn--accent xe_btn--small" href={WINDOWS_SHIT.setup}>
            <DownloadIcon size={14} />
            Download
          </a>
        </div>
      </div>

      <h3 className="xe_about__heading">PWA</h3>
      <div className="xe_about__downloads">
        <div className="xe_about__download-item">
          <span className="xe_about__download-icon">
            <DownloadIcon size={18} />
          </span>
          <div className="xe_about__download-details">
            <strong>PWA</strong>
          </div>
          <button
            type="button"
            className="xe_btn xe_btn--accent xe_btn--small"
            disabled={isElectron || pwa.installed || !pwa.available}
            onClick={() => void pwa.prompt()}
          >
            <DownloadIcon size={14} />
            {pwa.installed ? 'Installed' : 'Install'}
          </button>
        </div>
      </div>
      {isElectron ? (
        <p className="xe_about__text">You are running Electron</p>
      ) : !pwa.installed && !pwa.available && (
        <p className="xe_about__text">
          This browser has not (yet) offered an install prompt. Use its install or add to home screen option if it has one
        </p>
      )}
    </section>
  );
}
