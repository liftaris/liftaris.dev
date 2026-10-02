import { PAGE_SOURCES } from '../things/model';

type Target = {
  id?: string;
  href?: string | null;
  kind?: string;
  page_source?: keyof typeof PAGE_SOURCES;
  previewUrl?: string;
  items?: readonly unknown[];
};
let prefetchFn: ((url: string) => void) | undefined;

/** Shared with PageReader so the warmed URL exactly matches the opened page. */
export function windowPageUrl(href: string): string {
  const url = new URL(href, 'https://portfolio.invalid');
  url.searchParams.set('window', '1');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function getThingPrefetchUrls(thing?: Target | null): string[] {
  const urls = new Set<string>();
  const visited = new Set<Target>();
  function visit(target?: Target | null) {
    if (!target || target.previewUrl || visited.has(target)) return;
    visited.add(target);
    for (const entry of target.items ?? []) {
      if (entry && typeof entry === 'object') visit(('value' in entry ? entry.value : entry) as Target);
    }
    const url = target.href || (target.page_source ? PAGE_SOURCES[target.page_source] : null);
    if (!url?.startsWith('/') || url.startsWith('//')) return;
    urls.add(url);
    if (target.kind === 'page' || target.kind === 'post') urls.add(windowPageUrl(url));
  }
  visit(thing);
  return [...urls];
}

export function prefetchUrl(url?: string | null) {
  if (!url || typeof window === 'undefined') return;
  if (prefetchFn) { prefetchFn(url); return; }
  void import('astro:prefetch').then(mod => {
    prefetchFn = mod.prefetch;
    prefetchFn(url);
  }).catch(() => {});
}

export function prefetchThing(thing?: Target | null) {
  for (const url of getThingPrefetchUrls(thing)) prefetchUrl(url);
}
