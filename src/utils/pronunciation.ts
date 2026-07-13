export interface ArtistPronunciation {
  artist: string;
  pronunciation: string;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function applyPronunciations(text: string, rules: ArtistPronunciation[]): string {
  let result = text;
  for (const { artist, pronunciation } of rules) {
    if (!artist.trim()) continue;
    result = result.replace(new RegExp(escapeRegExp(artist), 'gi'), pronunciation);
  }
  return result;
}
