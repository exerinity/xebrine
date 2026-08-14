const LEGACY_HOST = 'xebrine.exerinity.com';
const CURRENT_HOST = 'xebrine.com';
const MIGRATION_FRAGMENT = '#xebrine-migrate=';

const MIGRATABLE_KEYS = [
  'hai',
  'xebrine.settings',
  'xebrine.volume',
  'xebrine.repeat',
  'xebrine.automix',
  'xebrine.timeMode',
  'xebrine.navWidth',
  'xebrine.albumsSort',
  'xebrine.albumsSort.direction',
  'xebrine.artistsSort',
  'xebrine.artistsSort.direction',
  'xebrine.artistAlbumsSort',
  'xebrine.artistAlbumsSort.direction',
  'xebrine.artistAlbumsView'
] as const;

interface MigrationPayload {
  version: 1;
  values: Record<string, string>;
}

function collectSettings(): MigrationPayload {
  const values: Record<string, string> = {};
  for (const key of MIGRATABLE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) values[key] = value;
  }
  return { version: 1, values };
}

function importSettings(encoded: string): void {
  try {
    const payload = JSON.parse(decodeURIComponent(encoded)) as Partial<MigrationPayload>;
    if (payload.version !== 1 || !payload.values || typeof payload.values !== 'object') return;
    for (const key of MIGRATABLE_KEYS) {
      const value = payload.values[key];
      if (typeof value === 'string') localStorage.setItem(key, value);
    }
  } catch {
    null;
  }
}

export function handleDomainMigration(): boolean {
  if (window.location.hostname === LEGACY_HOST) {
    const target = new URL(window.location.href);
    target.protocol = 'https:';
    target.hostname = CURRENT_HOST;
    target.port = '';
    try {
      target.hash = `${MIGRATION_FRAGMENT}${encodeURIComponent(JSON.stringify(collectSettings()))}`;
    } catch {
      target.hash = '';
    }
    window.location.replace(target.toString());
    return true;
  }

  if (
    window.location.hostname === CURRENT_HOST &&
    window.location.hash.startsWith(MIGRATION_FRAGMENT)
  ) {
    importSettings(window.location.hash.slice(MIGRATION_FRAGMENT.length));
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`
    );
  }

  return false;
}
