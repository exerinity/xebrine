export type ThemeId =
  | 'default'
  | 'adaptive'
  | 'dim'
  | 'purple'
  | 'lights-out'
  | 'high-contrast'
  | 'light'
  | 'red'
  | 'neon-purple'
  | 'neon-blue'
  | 'green';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  swatch: [bg: string, panel: string, text: string];
}

export const THEMES: ThemeMeta[] = [
  { id: 'default', label: 'Xebrine', swatch: ['#030003', '#1c2130', '#9aa2b5'] },
  { id: 'adaptive', label: 'Adaptive', swatch: ['#05070d', '#171d2a', '#9b82f3'] },
  { id: 'dim', label: 'Dim', swatch: ['#121212', '#1f1f1f', '#d0d0d0'] },
  { id: 'purple', label: 'Purple', swatch: ['#05000b', '#180a28', '#c8c0dc'] },
  { id: 'lights-out', label: 'Lights out', swatch: ['#000000', '#111111', '#cfcfcf'] },
  { id: 'high-contrast', label: 'High contrast', swatch: ['#000000', '#000000', '#ffffff'] },
  { id: 'light', label: 'Light', swatch: ['#f7f7f7', '#f5f5f5', '#444444'] },
  { id: 'red', label: 'Red', swatch: ['#150000', '#2a0000', '#d9a9a9'] },
  { id: 'neon-purple', label: 'Neon purple', swatch: ['#0a0011', '#2d0055', '#d6a0ff'] },
  { id: 'neon-blue', label: 'Neon blue', swatch: ['#000511', '#001f3d', '#a0c8ff'] },
  { id: 'green', label: 'Green', swatch: ['#00140e', '#002d22', '#a2c4b0'] }
];

const VALID_IDS = new Set<ThemeId>(THEMES.map((t) => t.id));

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && VALID_IDS.has(value as ThemeId);
}
