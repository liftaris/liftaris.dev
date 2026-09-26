import { describe, expect, test } from "bun:test";
import { handleMediaCache, MEDIA_EDGE_CACHE_CONTROL } from "./media-cache";

describe("Cloudflare media cache handler", () => {
  test("media file requests receive 30-day edge cache headers", async () => {
    const mockRequest = new Request("https://www.liftaris.dev/_emdash/api/media/file/avatar.webp");
    let putCalled = false;
    let waitUntilCalled = false;
    const mockCache = {
      match: async () => null,
      put: async () => { putCalled = true; },
    };
    (globalThis as unknown as { caches: { default: unknown } }).caches = { default: mockCache };

    const originResponse = new Response("image-bytes", {
      status: 200,
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=0, must-revalidate" },
    });

    const response = await handleMediaCache(
      mockRequest,
      async () => originResponse,
      (p) => { waitUntilCalled = true; void p; },
    );

    expect(response.headers.get("Cache-Control")).toBe(MEDIA_EDGE_CACHE_CONTROL);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=2592000");
    expect(response.headers.get("Cache-Control")).toContain("max-age=2592000");
    expect(putCalled).toBe(true);
    expect(waitUntilCalled).toBe(true);
  });

  test("cached media response is returned without calling origin", async () => {
    const mockRequest = new Request("https://www.liftaris.dev/_emdash/api/media/file/cached.png");
    const cachedResponse = new Response("cached-data", {
      status: 200,
      headers: { "Cache-Control": "public, max-age=2592000" },
    });
    const mockCache = {
      match: async () => cachedResponse,
      put: async () => {},
    };
    (globalThis as unknown as { caches: { default: unknown } }).caches = { default: mockCache };

    let originCalled = false;
    const response = await handleMediaCache(
      mockRequest,
      async () => { originCalled = true; return new Response(); },
    );

    expect(originCalled).toBe(false);
    expect(await response.text()).toBe("cached-data");
  });

  test("non-media requests pass through to origin untouched", async () => {
    const mockRequest = new Request("https://www.liftaris.dev/blog/first-post");
    const originResponse = new Response("html-content", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });

    const response = await handleMediaCache(
      mockRequest,
      async () => originResponse,
    );

    expect(response.headers.get("Cache-Control")).toBeNull();
    expect(await response.text()).toBe("html-content");
  });
});
