import { describe, expect, test, mock } from "bun:test";
import { getThingPrefetchUrls, getCachedWindowHtml, preloadWindowHtml, prefetchThing } from "./prefetch";

describe("prefetch helper", () => {
  test("resolves github url", () => {
    expect(getThingPrefetchUrls({ id: "github" })).toEqual(["/github"]);
  });

  test("resolves projects url for computer or action", () => {
    expect(getThingPrefetchUrls({ id: "computer" })).toEqual(["/projects"]);
    expect(getThingPrefetchUrls({ id: "custom", action: "projects" })).toEqual(["/projects"]);
  });

  test("resolves experience url for case or action", () => {
    expect(getThingPrefetchUrls({ id: "case" })).toEqual(["/experience"]);
    expect(getThingPrefetchUrls({ id: "custom", action: "experience" })).toEqual(["/experience"]);
  });

  test("resolves blog post url and window iframe url", () => {
    expect(getThingPrefetchUrls({ id: "post-1", kind: "post", href: "/blog/my-post" })).toEqual([
      "/blog/my-post",
      "/blog/my-post?window=1",
    ]);
  });

  test("resolves page url and window iframe url", () => {
    expect(getThingPrefetchUrls({ id: "about", kind: "page", href: "/p/about" })).toEqual([
      "/p/about",
      "/p/about?window=1",
    ]);
    expect(getThingPrefetchUrls({ id: "about", kind: "page" })).toEqual([
      "/p/about",
      "/p/about?window=1",
    ]);
  });

  test("returns empty array for regular objects or gifts without routes", () => {
    expect(getThingPrefetchUrls({ id: "octopus", kind: "object" })).toEqual([]);
    expect(getThingPrefetchUrls({ id: "shoes", kind: "object" })).toEqual([]);
    expect(getThingPrefetchUrls(null)).toEqual([]);
  });

  test("prefetches and caches window html via preloadWindowHtml", async () => {
    const originalFetch = globalThis.fetch;
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = globalThis;
    globalThis.fetch = mock(async () => {
      return new Response("<html><body><h1>Hello World</h1></body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }) as unknown as typeof fetch;

    try {
      const url = "/blog/test-caching?window=1";
      expect(getCachedWindowHtml(url)).toBeNull();

      const html = await preloadWindowHtml(url);
      expect(html).toContain("Hello World");
      expect(getCachedWindowHtml(url)).toContain("Hello World");

      // Second call should return cached without fetching again
      const cached = await preloadWindowHtml(url);
      expect(cached).toBe(html);
    } finally {
      globalThis.fetch = originalFetch;
      (globalThis as any).window = originalWindow;
    }
  });

  test("prefetchThing preloads window=1 for post items", async () => {
    const originalFetch = globalThis.fetch;
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = globalThis;
    let fetchedUrl = "";
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      fetchedUrl = String(url);
      return new Response("<article>Post Content</article>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }) as unknown as typeof fetch;

    try {
      prefetchThing({ kind: "post", id: "post:sample", href: "/blog/sample" });
      // Allow async fetch microtask to run
      await new Promise((r) => setTimeout(r, 10));
      expect(fetchedUrl).toBe("/blog/sample?window=1");
      expect(getCachedWindowHtml("/blog/sample?window=1")).toBe("<article>Post Content</article>");
    } finally {
      globalThis.fetch = originalFetch;
      (globalThis as any).window = originalWindow;
    }
  });
});
