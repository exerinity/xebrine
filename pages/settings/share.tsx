import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSettings, type Settings } from '../../context/settings_context';
import { toast } from '../../utils/toast';
import { parseSettingsJson, paramsToSettings, settingsToParams } from '../../utils/settings_transfer';
import { Modal } from '../../components/modal';

export function ShareSettings({ show_heading }: { show_heading: boolean }) {
  const { settings, update } = useSettings();
  const [pendingImport, setPendingImport] = useState<{
    settings: Partial<Settings>;
    fromUrl: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'xebrine-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = parseSettingsJson(await file.text());
      if (Object.keys(parsed).length === 0) {
        toast.error('Nothing to do with this file');
        return;
      }
      setPendingImport({ settings: parsed, fromUrl: false });
    } catch {
      toast.error('Invalid Xebrine settings JSON');
    }
  };

  const shareUrl = `${window.location.origin}/settings/share?${settingsToParams(settings)}`;

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share URL copied to clipboard');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const incomingSettings = paramsToSettings(searchParams);
  const incomingCount = Object.keys(incomingSettings).length;

  const applyPendingImport = () => {
    if (!pendingImport) return;
    const count = Object.keys(pendingImport.settings).length;
    update(pendingImport.settings);
    toast.success(`Applied ${count} setting${count === 1 ? '' : 's'}`);
    const fromUrl = pendingImport.fromUrl;
    setPendingImport(null);
    if (fromUrl) navigate('/settings/share');
  };

  const formatValue = (value: unknown) =>
    typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);

  return (
    <>
      {show_heading && <h2 className="xe_settings__category-heading">Share settings</h2>}
      {incomingCount > 0 && (
        <div className="xe_banner xe_banner--info">
          <span>
            <strong>{incomingCount}</strong> shared setting{incomingCount === 1 ? '' : 's'} to apply
          </span>
          <button
            type="button"
            className="xe_btn xe_btn--accent"
            onClick={() => setPendingImport({ settings: incomingSettings, fromUrl: true })}
          >
            Review & apply
          </button>
        </div>
      )}

      {pendingImport && (
        <Modal title="Import these settings?" onClose={() => setPendingImport(null)}>
          <ul className="xe_settings__import-list">
            {Object.entries(pendingImport.settings).map(([key, value]) => (
              <li key={key}>
                <span className="xe_settings__import-key">{key}</span>
                <span className="xe_settings__import-value">{formatValue(value)}</span>
              </li>
            ))}
          </ul>
          <div className="xe_settings__actions">
            <button type="button" className="xe_btn xe_btn--accent" onClick={applyPendingImport}>
              Apply {Object.keys(pendingImport.settings).length} setting
              {Object.keys(pendingImport.settings).length === 1 ? '' : 's'}
            </button>
            <button type="button" className="xe_btn" onClick={() => setPendingImport(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      <section className="xe_settings__section">
        <h2>As a file</h2>
        <p className="xe_settings__hint">
          Export every setting to a JSON file, or load one back in
        </p>
        <div className="xe_settings__actions">
          <button type="button" className="xe_btn" onClick={exportJson}>
            Export JSON
          </button>
          <button type="button" className="xe_btn" onClick={() => fileInputRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importJson(file);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      <section className="xe_settings__section">
        <h2>As a link (recommended)</h2>
        <p className="xe_settings__hint">
          Packs all settings into parameters in a URL
        </p>
        <input type="text" className="xe_search-input xe_settings__share-url" value={shareUrl} readOnly onFocus={(e) => e.target.select()} />
        <div className="xe_settings__actions">
          <button type="button" className="xe_btn xe_btn--accent" onClick={copyShareUrl}>
            Copy link
          </button>
        </div>
      </section>
    </>
  );
}
