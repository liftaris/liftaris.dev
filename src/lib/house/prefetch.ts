import { PAGE_SOURCES } from '../things/model';

type Target = {
  href?: string | null;
  kind?: string;
  page_source?: keyof typeof PAGE_SOURCES;
  previewUrl?: string;
};
let prefetchFn: ((url: string) => void) | undefined;

/** Shared with PageReader so the warmed URL exactly matches the opened page. */
export function windowPageUrl(href: string): string {
  const url = new URL(href, 'https://portfolio.invalid');
  url.searchParams.set('window', '1');
  return `${url.pathname}${url.search}${url.hash}`;
}

function getThingPrefetchUrls(thing?: Target | null): string[] {
  // Folders already render from the scene data. Warming every descendant here
  // makes the page the visitor actually chooses compete with unrelated renders.
  if (!thing || thing.previewUrl || thing.kind === 'folder') return [];
  const url = thing.href || (thing.page_source ? PAGE_SOURCES[thing.page_source] : null);
  if (!url?.startsWith('/') || url.startsWith('//')) return [];
  return [thing.kind === 'page' ? windowPageUrl(url) : url];
}

function prefetchUrl(url?: string | null) {
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
