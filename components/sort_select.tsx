export interface SortOption<T extends string> {
  value: T;
  label: string;
}

interface SortSelectProps<T extends string> {
  value: T;
  onChange(value: T): void;
  options: readonly SortOption<T>[];
}

export function SortSelect<T extends string>({ value, onChange, options }: SortSelectProps<T>) {
  return (
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
  );
}
