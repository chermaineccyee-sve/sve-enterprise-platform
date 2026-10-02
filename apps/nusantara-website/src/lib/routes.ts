/**
 * Deep links into the analytical layer. Every surface routes the same way, and
 * each destination restores its selection from the URL:
 *   market     → Market Dashboard with that instrument selected
 *   dimension  → homepage Market State with that dimension selected
 *   capability → Strategies allocation universe with that capability selected
 */
export const routes = {
  market: (id: string) => `/market-dashboard?instrument=${encodeURIComponent(id)}`,
  dimension: (id: string) => `/?dimension=${encodeURIComponent(id)}#market-state`,
  capability: (slug: string) => `/strategies?capability=${encodeURIComponent(slug)}#capabilities`,
};

/** Replaces one query parameter in the current URL without navigation or scroll. */
export function setUrlParam(key: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  window.history.replaceState(window.history.state, "", url);
}

export function getUrlParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}
