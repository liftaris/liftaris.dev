/** Reuse public documents for desktop returns and iframe navigations.
 * Editor and signed-preview responses must always be fresh.
 */
export function pageCacheControl(request: Request, preview: boolean): string {
  const url = new URL(request.url);
  const cookies = request.headers.get('cookie') ?? '';
  const privateRequest = preview || request.headers.has('authorization') ||
    /(?:^|;\s*)emdash-edit-mode=true(?:;|$)/.test(cookies) ||
    [...url.searchParams.keys()].some(key => key !== 'window');
  if (request.method !== 'GET' || privateRequest) return 'private, no-store';
  // Allow Cloudflare edge caching for public requests; keep private for preview/edit mode.
  return url.pathname === '/'
    ? 'public, max-age=30, s-maxage=300, stale-while-revalidate=86400'
    : 'public, max-age=30, s-maxage=300, stale-while-revalidate=86400';
}
