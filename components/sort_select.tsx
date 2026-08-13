import { SortAscendingIcon, SortDescendingIcon } from './icons';

export interface SortOption<T extends string> {
  value: T;
  label: string;
}

export type SortDirection = 'asc' | 'desc';

interface SortSelectProps<T extends string> {
  value: T;
  onChange(value: T): void;
  options: readonly SortOption<T>[];
  direction?: SortDirection;
  onDirectionChange?(direction: SortDirection): void;
}

export function SortSelect<T extends string>({
  value,
  onChange,
  options,
  direction,
  onDirectionChange
}: SortSelectProps<T>) {
  return (
    <div className="xe_sort-control">
      <select
        className="xe_sort-select"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label="Sort by"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {direction && onDirectionChange && (
        <button
          type="button"
          className="xe_sort-direction"
          onClick={() => onDirectionChange(direction === 'asc' ? 'desc' : 'asc')}
          title={`Sort ${direction === 'asc' ? 'descending' : 'ascending'}`}
          aria-label={`Sort ${direction === 'asc' ? 'ascending' : 'descending'}; activate to sort ${direction === 'asc' ? 'descending' : 'ascending'}`}
        >
          {direction === 'asc' ? <SortAscendingIcon size={16} /> : <SortDescendingIcon size={16} />}
        </button>
      )}
    </div>
  );
}
