/** A short, browser-only cache lets Astro prefetch warm embedded public pages.
 * Editor and signed-preview responses must always be fresh.
 */
export function windowCacheControl(request: Request, preview: boolean): string {
  const url = new URL(request.url);
  const cookies = request.headers.get('cookie') ?? '';
  const privateRequest = preview || request.headers.has('authorization') ||
    /(?:^|;\s*)emdash-edit-mode=/.test(cookies) ||
    [...url.searchParams.keys()].some(key => key !== 'window');
  return ['GET', 'HEAD'].includes(request.method) && !privateRequest
    ? 'private, max-age=120'
    : 'private, no-store';
}
