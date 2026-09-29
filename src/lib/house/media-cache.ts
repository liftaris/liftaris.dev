export const MEDIA_FILE_PREFIX = "/_emdash/api/media/file/";
export const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;
export const MEDIA_EDGE_CACHE_CONTROL = `public, max-age=${THIRTY_DAYS_SECONDS}, s-maxage=${THIRTY_DAYS_SECONDS}, stale-while-revalidate=86400`;

export async function handleMediaCache(
  request: Request,
  fetchOrigin: (req: Request) => Promise<Response>,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Response> {
  const url = new URL(request.url);
  const isMediaFile = url.pathname.startsWith(MEDIA_FILE_PREFIX) || url.pathname === "/_image";

  if (isMediaFile && (request.method === "GET" || request.method === "HEAD")) {
    const cache = typeof caches !== "undefined" ? (caches as unknown as { default?: Cache }).default : undefined;
    if (cache) {
      const cached = await cache.match(request);
      if (cached) return cached;
    }

    const response = await fetchOrigin(request);

    if (response.status === 200) {
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", MEDIA_EDGE_CACHE_CONTROL);
      const cachedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });

      if (cache) {
        waitUntil?.(cache.put(request, cachedResponse.clone()));
      }
      return cachedResponse;
    }

    return response;
  }

  return fetchOrigin(request);
}
