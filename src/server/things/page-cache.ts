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
  // After a longer read, return immediately while the browser refreshes the
  // desktop in the background. This cache is browser-only, never shared at edge.
  return url.pathname === '/'
    ? 'private, max-age=30, stale-while-revalidate=300'
    : 'private, max-age=30';
}
