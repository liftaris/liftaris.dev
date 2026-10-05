/** A short browser cache covers native iframe navigations after eviction.
 * Editor and signed-preview responses must always be fresh.
 */
export function windowCacheControl(request: Request, preview: boolean): string {
  const url = new URL(request.url);
  const cookies = request.headers.get('cookie') ?? '';
  const privateRequest = preview || request.headers.has('authorization') ||
    /(?:^|;\s*)emdash-edit-mode=true(?:;|$)/.test(cookies) ||
    [...url.searchParams.keys()].some(key => key !== 'window');
  return request.method === 'GET' && !privateRequest
    ? 'private, max-age=30'
    : 'private, no-store';
}
