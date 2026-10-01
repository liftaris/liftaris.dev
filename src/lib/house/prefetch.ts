const windowHtmlCache = new Map<string, string>();
const inFlightWindowHtml = new Map<string, Promise<string>>();

export function getCachedWindowHtml(url?: string | null): string | null {
  if (!url) return null;
  return windowHtmlCache.get(url) ?? null;
}

export function preloadWindowHtml(url?: string | null): Promise<string> {
  if (!url || typeof window === "undefined") return Promise.resolve("");
  const cached = windowHtmlCache.get(url);
  if (cached) return Promise.resolve(cached);
  const pending = inFlightWindowHtml.get(url);
  if (pending) return pending;

  const promise = fetch(url, { priority: "high" })
    .then((res) => (res.ok ? res.text() : ""))
    .then((html) => {
      if (html) windowHtmlCache.set(url, html);
      inFlightWindowHtml.delete(url);
      return html;
    })
    .catch(() => {
      inFlightWindowHtml.delete(url);
      return "";
    });

  inFlightWindowHtml.set(url, promise);
  return promise;
}

let prefetchFn: ((url: string) => void) | undefined;

export function prefetchUrl(url?: string | null): void {
  if (!url || typeof window === "undefined") return;
  if (prefetchFn) {
    try {
      prefetchFn(url);
    } catch {}
    return;
  }
  void import("astro:prefetch")
    .then((mod) => {
      prefetchFn = mod.prefetch;
      prefetchFn(url);
    })
    .catch(() => {});
}

export function getThingPrefetchUrls(thing?: { id?: string; action?: string; href?: string | null; kind?: string } | null): string[] {
  if (!thing) return [];
  const urls: string[] = [];
  let url: string | undefined;

  if (thing.id === "github") {
    url = "/github";
  } else if (thing.action === "projects" || thing.id === "computer") {
    url = "/projects";
  } else if (thing.action === "experience" || thing.id === "case") {
    url = "/experience";
  } else if (thing.kind === "post" && thing.href) {
    url = thing.href;
  } else if (thing.kind === "page") {
    url = thing.href || (thing.id ? `/p/${encodeURIComponent(thing.id)}` : undefined);
  } else if (thing.href?.startsWith("/")) {
    url = thing.href;
  }

  if (url) {
    urls.push(url);
    if (thing.kind === "post" || thing.kind === "page") {
      const windowUrl = `${url}${url.includes("?") ? "&" : "?"}window=1`;
      urls.push(windowUrl);
    }
  }
  return urls;
}

export function prefetchThing(thing?: { id?: string; action?: string; href?: string | null; kind?: string; items?: readonly unknown[] } | null): void {
  if (!thing) return;
  if ("items" in thing && Array.isArray(thing.items)) {
    for (const item of thing.items) {
      if (item && typeof item === "object") {
        const target = "kind" in item && item.kind === "item" && "value" in item ? item.value : item;
        prefetchThing(target as { id?: string; action?: string; href?: string | null; kind?: string });
      }
    }
  }
  const urls = getThingPrefetchUrls(thing);
  for (const url of urls) {
    if (url.includes("window=1")) {
      void preloadWindowHtml(url);
    } else {
      prefetchUrl(url);
    }
  }
}
