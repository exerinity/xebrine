import { useState, type FormEvent } from 'react';
import type { radio_field, radio_resource } from '../utils/radio_catalog';
import { radio_resource_defaults } from '../utils/radio_catalog';
import { FloatingInput } from './floating_input';
import { Modal } from './modal';
import { SearchIcon } from './icons';

interface radio_filter_modal_props {
  resource: radio_resource;
  values: Record<string, string>;
  suggestions_unavailable: boolean;
  on_apply(values: Record<string, string>): void;
  on_close(): void;
}

const FIELD_GROUPS = [
  { label: 'Station', keys: ['name', 'filter', 'url', 'uuids', 'stationuuid', 'country', 'countrycode', 'state', 'language', 'tag', 'tagList', 'codec'] },
  { label: 'Matching and availability', keys: ['nameExact', 'countryExact', 'stateExact', 'languageExact', 'tagExact', 'hidebroken', 'hide_unplayable', 'is_https', 'has_geo_info', 'has_extended_info'] },
  { label: 'Quality and location', keys: ['bitrateMin', 'bitrateMax', 'geo_lat', 'geo_long', 'geo_distance'] },
  { label: 'Ordering and results', keys: ['order', 'reverse', 'limit', 'offset', 'seconds', 'lastcheckuuid', 'lastclickuuid', 'lastchangeuuid'] }
];

const LABELS: Record<string, string> = {
  name: 'Station name', url: 'Stream URL', homepage: 'Homepage', favicon: 'Logo', tags: 'Tags',
  country: 'Country', state: 'State or region', language: 'Language', votes: 'Votes', codec: 'Codec',
  bitrate: 'Bitrate', lastcheckok: 'Last check result', lastchecktime: 'Last checked',
  clicktimestamp: 'Last played', clickcount: 'Play count', clicktrend: 'Play trend',
  changetimestamp: 'Last changed', random: 'Random', stationcount: 'Station count'
};

function Filter_field({ field, value, on_change }: { field: radio_field; value: string; on_change(value: string): void }) {
  if (field.type === 'boolean' || field.type === 'select') {
    return (
      <label className="xe_lrclib-search__field xe_floating-input">
        <span className="xe_page__meta">{field.label}</span>
        <select className="xe_sort-select" value={value} onChange={event => on_change(event.target.value)} required={field.required}>
          <option value="">{field.type === 'boolean' ? 'Any' : 'Default'}</option>
          {(field.type === 'boolean' ? ['true', 'false'] : field.choices ?? []).map(choice => (
            <option value={choice} key={choice}>{choice === 'true' ? 'Yes' : choice === 'false' ? 'No' : LABELS[choice] ?? choice}</option>
          ))}
        </select>
      </label>
    );
  }
  const lists: Record<string, string> = { countrycode: 'radio_countries', language: 'radio_languages', tag: 'radio_tags', codec: 'radio_codecs' };
  return (
    <FloatingInput containerClassName="xe_lrclib-search__field" label={field.label} type={field.type ?? 'text'}
      value={value} onChange={event => on_change(event.target.value)} list={lists[field.key]}
      required={field.required} min={field.min} max={field.max} step={field.key.startsWith('geo_') ? 'any' : 1}
      maxLength={field.key === 'name' ? 400 : 4000} />
  );
}

export function Radio_filter_modal({ resource, values, suggestions_unavailable, on_apply, on_close }: radio_filter_modal_props) {
  const [draft, set_draft] = useState({ ...values });
  const [error, set_error] = useState('');
  const known_keys = new Set(FIELD_GROUPS.flatMap(group => group.keys));
  const groups = [...FIELD_GROUPS, { label: 'Other filters', keys: resource.fields.filter(field => !known_keys.has(field.key)).map(field => field.key) }];

  function apply(event: FormEvent) {
    event.preventDefault();
    if (draft.bitrateMin && draft.bitrateMax && Number(draft.bitrateMin) > Number(draft.bitrateMax)) {
      set_error('Minimum bitrate must not exceed maximum bitrate');
      return;
    }
    if (Boolean(draft.geo_lat?.trim()) !== Boolean(draft.geo_long?.trim())) {
      set_error('Enter both latitude and longitude');
      return;
    }
    if (draft.geo_distance?.trim() && !draft.geo_lat?.trim()) {
      set_error('Enter a location to search by distance');
      return;
    }
    on_apply(draft);
  }

  return (
    <Modal title="Radio filters and ordering" wide onClose={on_close}>
      <form className="xe_lrclib-search__form" onSubmit={apply}>
        <p className="xe_lrclib-search__hint">{resource.label}</p>
        {groups.map(group => {
          const fields = resource.fields.filter(field => group.keys.includes(field.key));
          if (!fields.length) return null;
          return <fieldset className="xe_lrclib-search__mode-fieldset" key={group.label}>
            <legend className="xe_lrclib-search__legend">{group.label}</legend>
            <div className="xe_lrclib-search__fields">
              {fields.map(field => <Filter_field key={field.key} field={field} value={draft[field.key] ?? ''}
                on_change={value => {
                  set_error('');
                  set_draft(current => ({ ...current, ...(field.key !== 'offset' && resource.fields.some(item => item.key === 'offset') ? { offset: '0' } : {}), [field.key]: value }));
                }} />)}
            </div>
          </fieldset>;
        })}
        {suggestions_unavailable && <p className="xe_lrclib-search__hint">Filter suggestions are unavailable, you can still enter values</p>}
        {error && <p className="xe_lrclib-search__validation" role="alert">{error}</p>}
        <div className="xe_lrclib-search__actions">
          <div className="xe_lrclib-search__actions-start">
            <button className="xe_btn xe_btn--quiet" type="button" onClick={() => { set_draft(radio_resource_defaults(resource)); set_error(''); }}>Reset</button>
            <button className="xe_btn xe_btn--quiet" type="button" onClick={on_close}>Cancel</button>
          </div>
          <button className="xe_btn xe_btn--accent" type="submit"><SearchIcon size={14} />Apply filters</button>
        </div>
      </form>
    </Modal>
  );
}
