import { PAGE_SOURCES } from '../things/model';

type Target = {
  id?: string;
  href?: string | null;
  kind?: string;
  action?: string | null;
  page_source?: keyof typeof PAGE_SOURCES;
  previewUrl?: string;
  items?: readonly unknown[];
};
let prefetchFn: ((url: string) => void) | undefined;

/** Shared in-memory HTML cache for instantaneous window openings and zero flash. */
const htmlCache = new Map<string, { html: string; timestamp: number }>();
const inFlightRequests = new Map<string, Promise<string>>();

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

export function getCachedWindowHtml(url: string): string | null {
  const entry = htmlCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    htmlCache.delete(url);
    return null;
  }
  return entry.html;
}

export function preloadWindowHtml(url: string): Promise<string> {
  const cached = getCachedWindowHtml(url);
  if (cached) return Promise.resolve(cached);

  const existing = inFlightRequests.get(url);
  if (existing) return existing;

  const promise = fetch(url, { headers: { Accept: 'text/html' } })
    .then(async (res) => {
      if (!res.ok || !res.headers.get('content-type')?.includes('text/html')) {
        throw new Error('Unavailable');
      }
      if (new URL(res.url, location.href).origin !== location.origin) {
        throw new Error('External');
      }
      const html = await res.text();
      htmlCache.set(url, { html, timestamp: Date.now() });
      return html;
    })
    .finally(() => {
      inFlightRequests.delete(url);
    });

  inFlightRequests.set(url, promise);
  return promise;
}

export function invalidateWindowHtmlCache(urlPattern?: string) {
  if (!urlPattern) {
    htmlCache.clear();
    return;
  }
  for (const key of htmlCache.keys()) {
    if (key.includes(urlPattern)) {
      htmlCache.delete(key);
    }
  }
}

/** Shared with PageReader so the warmed URL exactly matches the opened page. */
export function windowPageUrl(href: string): string {
  const url = new URL(href, 'https://portfolio.invalid');
  url.searchParams.set('window', '1');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function getThingPrefetchUrls(thing?: Target | null): string[] {
  // Folders already render from the scene data. Warming every descendant here
  // makes the page the visitor actually chooses compete with unrelated renders.
  if (!thing || thing.previewUrl || thing.kind === 'folder') return [];
  const sourceUrl = thing.page_source ? PAGE_SOURCES[thing.page_source] : null;
  const actionUrl = thing.action === 'projects' ? '/projects' : thing.action === 'experience' ? '/experience' : null;
  const builtinUrl = thing.id === 'computer' ? '/projects' : thing.id === 'case' ? '/experience' : thing.id === 'github' ? '/github' : null;
  const url = thing.href || sourceUrl || actionUrl || builtinUrl;
  if (!url?.startsWith('/') || url.startsWith('//')) return [];
  return [thing.kind === 'page' || thing.kind === 'post' || thing.kind === 'object' || !thing.kind ? windowPageUrl(url) : url];
}

export function prefetchUrl(url?: string | null) {
  if (!url || typeof window === 'undefined') return;

  // 1. Warm in-memory cache for window iframe pages so PageReader can synchronously read on mount
  if (url.includes('window=1') || url.startsWith('/')) {
    void preloadWindowHtml(url).catch(() => {});
  }

  // 2. Also register with Astro's built-in prefetch router (for links, browser speculation rules, HTTP prefetch)
  if (prefetchFn) {
    prefetchFn(url);
    return;
  }
  void import('astro:prefetch').then(mod => {
    prefetchFn = mod.prefetch;
    prefetchFn(url);
  }).catch(() => {});
}

export function prefetchThing(thing?: Target | null) {
  for (const url of getThingPrefetchUrls(thing)) prefetchUrl(url);
}
