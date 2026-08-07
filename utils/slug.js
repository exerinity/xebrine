export function slugify(value) {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

export function toSlugParam(value) {
  return encodeURIComponent(slugify(value));
}
