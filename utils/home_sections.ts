export const HOME_SECTION_IDS = [
  'random-albums',
  'random-song',
  'trending-worldwide',
  'trending-country',
  'top-tracks-week',
  'top-tracks-all-time'
] as const;

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

export const DEFAULT_HOME_SECTIONS: HomeSectionId[] = [...HOME_SECTION_IDS];

export const HOME_SECTION_LABELS: Record<HomeSectionId, string> = {
  'random-albums': 'Pick some random albums',
  'random-song': 'Choose a random song',
  'trending-worldwide': 'Trending worldwide',
  'trending-country': 'Trending in your country',
  'top-tracks-week': 'Your top tracks this week',
  'top-tracks-all-time': 'Your top tracks of all time'
};

export function isHomeSectionId(value: unknown): value is HomeSectionId {
  return typeof value === 'string' && HOME_SECTION_IDS.includes(value as HomeSectionId);
}

export function normalizeHomeSections(value: unknown): HomeSectionId[] {
  if (!Array.isArray(value)) return [...DEFAULT_HOME_SECTIONS];
  const sections: HomeSectionId[] = [];
  for (const entry of value) {
    if (isHomeSectionId(entry) && !sections.includes(entry)) sections.push(entry);
  }
  return sections;
}

export function moveHomeSection(
  sections: HomeSectionId[],
  source: HomeSectionId,
  target: HomeSectionId,
  after = false
): HomeSectionId[] {
  if (source === target) return sections;
  const next = sections.filter((section) => section !== source);
  const targetIndex = next.indexOf(target);
  if (targetIndex < 0) return sections;
  next.splice(targetIndex + (after ? 1 : 0), 0, source);
  return next;
}
