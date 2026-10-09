import type { APIContext } from 'astro';

// These tags match EmDash's native publish/settings invalidation. Collection tags
// cover folder moves, Post placements, navigation, and initially empty listings.
const PAGE_TAGS = ['things', 'posts', 'emdash:settings'];
type CacheContext = Pick<APIContext, 'request' | 'cache' | 'locals'>;

export function cachePublicResponse(
  context: CacheContext,
  headers: Headers,
  { privateResponse = false, window = false, maxAge = 86400, swr = 604800, tags = PAGE_TAGS } = {},
): void {
  const { request, cache } = context;
  const url = new URL(request.url);
  const query = [...url.searchParams];
  const publicQuery = query.length === 0 ||
    (window && query.length === 1 && query[0][0] === 'window' && query[0][1] === '1');
  const privateRequest = privateResponse || Boolean(context.locals.user) ||
    request.headers.has('authorization') ||
    /(?:^|;\s*)(?:astro-session|emdash-edit-mode|liftaris_setup)=/.test(request.headers.get('cookie') ?? '');

  // A shared anonymous entry must not bypass the session/authorization checks on
  // the next request: Workers Cache evaluates variants before invoking fetch.
  headers.append('Vary', 'Cookie, Authorization');
  if (!['GET', 'HEAD'].includes(request.method) || privateRequest || !publicQuery ||
      url.pathname.startsWith('/things-preview/')) {
    cache.set(false);
    headers.set('Cache-Control', 'private, no-store');
    headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
    return;
  }
  cache.set({ maxAge, swr, tags });
  // EmDash purges tagged edge entries on content changes, but cannot purge a
  // visitor's browser. Allow one hour of browser freshness and one day of SWR
  // for repeat window opens; honor shorter policies (including error fallbacks).
  const browserMaxAge = Math.min(maxAge, 3600);
  const browserSwr = Math.min(swr, 86400);
  headers.set('Cache-Control', `public, max-age=${browserMaxAge}${browserSwr > 0 ? `, stale-while-revalidate=${browserSwr}` : ''}`);
}

/** Run after rendering so layouts cannot re-enable caching on errors/redirects. */
export function finalizeResponseCache(context: CacheContext, response: Response): Response {
  if (response.status === 101) return response;
  const url = new URL(context.request.url);
  const imageSource = url.searchParams.get('href') ?? '';
  // Only build-hashed assets are immutable. CMS storage keys can be replaced,
  // so their native validators and short browser policy remain authoritative.
  if (url.pathname === '/_image' && response.status === 200 &&
      response.headers.get('Content-Type')?.startsWith('image/') &&
      /^\/_astro\/[\w.-]+[._][\w-]{8,}\.(?:png|jpe?g|webp|avif)$/.test(imageSource) &&
      ['GET', 'HEAD'].includes(context.request.method) && !context.locals.user &&
      !context.request.headers.has('cookie') && !context.request.headers.has('authorization') &&
      !response.headers.has('Set-Cookie')) {
    context.cache.set({ maxAge: 31536000 });
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    response.headers.append('Vary', 'Cookie, Authorization');
  }
  if ((response.status !== 200 && response.status !== 206 && response.status !== 304) || !['GET', 'HEAD'].includes(context.request.method) ||
      context.locals.user || response.headers.has('Set-Cookie') ||
      /\b(private|no-store)\b/i.test(response.headers.get('Cache-Control') ?? '')) {
    context.cache.set(false);
    // Native redirects/fetched responses can have immutable headers. Preserve
    // Astro's cookie jar when wrapping, as its cookies are serialized later.
    const original = response;
    response = new Response(original.body, original);
    const cookies = Symbol.for('astro.cookies');
    const descriptor = Object.getOwnPropertyDescriptor(original, cookies);
    if (descriptor) Object.defineProperty(response, cookies, descriptor);
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  }
  return response;
}
