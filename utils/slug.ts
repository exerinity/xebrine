export function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

export function toSlugParam(value: string): string {
  return encodeURIComponent(slugify(value));
}
