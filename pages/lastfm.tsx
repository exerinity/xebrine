import { ScrobblingSettings } from '../components/scrobbling_settings';
import { LastfmWordmark } from '../components/icons';
import { usePageTitle } from '../hooks/page_title';

export function LastfmPage() {
  usePageTitle('Last.fm scrobbling');

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <h1 className="xe_page__title">Last.fm scrobbling</h1>
        <LastfmWordmark height={20} />
      </div>

      <div className="xe_page__scroll">
        <ScrobblingSettings />
      </div>
    </div>
  );
}
