// Keep old bookmarks working without moving or rewriting local progress.
const LEGACY_PATHS = new Set(['/spelling-ea-ee', '/spelling-ea-ee/', '/spelling-ea-ee/index.html']);

export function legacySpellingRedirect(href) {
  let source;
  try { source = new URL(href); } catch { return null; }
  if (!['http:', 'https:'].includes(source.protocol) || !LEGACY_PATHS.has(source.pathname)) return null;
  const destination = new URL('/spelling/', source.origin);
  const list = source.searchParams.get('list');
  if (list && /^\d{4}-\d{2}-\d{2}$/.test(list)) destination.searchParams.set('list', list);
  return destination.href;
}

if (typeof window !== 'undefined') {
  const destination = legacySpellingRedirect(window.location.href);
  if (destination) window.location.replace(destination);
}
