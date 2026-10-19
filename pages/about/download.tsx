import { DownloadIcon } from '../../components/icons';

const LINUX_APPIMAGE_URL = 'https://espresso.exerinity.com/xebr/Xebrine-2.0.0.AppImage';

export function AboutDownload() {
  return (
    <section className="xe_about__download-section">
      <h3 className="xe_about__heading">Electron wrapper</h3>
      <p className="xe_about__text">
        The Electron wrapper gives Xebrine a dedicated multithreaded filesystem scanner and
        MPRIS support for Linux, ie, volume, shuffle, repeat controls that the browser normally
        wouldn't
      </p>
      <h4 className="xe_about__heading">Linux</h4>
      <div className="xe_about__download-item">
        <span className="xe_about__download-icon">
          <DownloadIcon size={20} />
        </span>
        <div className="xe_about__download-details">
          <strong>AppImage</strong>
        </div>
        <a className="xe_btn xe_btn--accent" href={LINUX_APPIMAGE_URL}>
          <DownloadIcon size={16} />
          Download
        </a>
      </div>
    </section>
  );
}
