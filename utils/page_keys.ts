import { clamp } from './format';

export type PageKeyMode = 'off' | 'shift' | 'page';

export const PAGE_KEY_MODES: PageKeyMode[] = ['off', 'shift', 'page'];

export const PAGE_KEY_LABELS: Record<PageKeyMode, string> = {
  off: 'disabled',
  shift: 'in tandem with shift',
  page: 'enabled'
};

export const PAGE_KEY_HINTS: Record<PageKeyMode, string> = {
  off: 'Page Up & Down do nothing special. Change this if you want to use them to switch between pages on the sidebar',
  shift: 'Hold Shift while pressing Page Up or Down to go up and down the ladder of sidebar pages',
  page: 'Page Up and Page Down go up and down the ladder of sidebar pages instead of scrolling the page'
};

export function isPageKeyMode(value: unknown): value is PageKeyMode {
  return typeof value === 'string' && (PAGE_KEY_MODES as string[]).includes(value);
}

export function pageKeyLevel(mode: PageKeyMode): number {
  return PAGE_KEY_MODES.indexOf(mode) + 1;
}

export function pageKeyModeFromLevel(level: number): PageKeyMode {
  return PAGE_KEY_MODES[clamp(Math.round(level), 1, PAGE_KEY_MODES.length) - 1];
}
