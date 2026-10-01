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

export function prefetchThing(thing?: { id?: string; action?: string; href?: string | null; kind?: string } | null): void {
  const urls = getThingPrefetchUrls(thing);
  for (const url of urls) {
    prefetchUrl(url);
  }
}
