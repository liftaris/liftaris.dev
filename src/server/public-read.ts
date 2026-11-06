const PRIVATE_PATH = /^\/(?:api|_emdash|_astro|_image|_media|admin|things-preview|404)(?:\/|$)/;
const MEDIA_FILE = /^\/_emdash\/api\/media\/file\/[A-Za-z0-9._-]+$/;
type WorkerRequest = Parameters<ExportedHandlerFetchHandler<Env>>[0];

export function isPublicMedia(url: URL): boolean {
  if (MEDIA_FILE.test(url.pathname)) return !url.search;
  if (url.pathname !== '/_image') return false;
  const keys = [...url.searchParams.keys()];
  if (new Set(keys).size !== keys.length || keys.some(key => !['href', 'w', 'h', 'f', 'q'].includes(key))) return false;
  const source = url.searchParams.get('href');
  return source !== null && MEDIA_FILE.test(source);
}

export function publicReadRequest(request: WorkerRequest): WorkerRequest {
  if (request.method !== 'GET' && request.method !== 'HEAD') return request;
  const url = new URL(request.url);
  const media = isPublicMedia(url);
  const cookie = request.headers.get('Cookie') ?? '';
  if (!media) {
    let path: string;
    try { path = decodeURIComponent(url.pathname); } catch { return request; }
    if (path !== url.pathname || path.includes('//') || PRIVATE_PATH.test(path) ||
        (path !== '/' && !/^\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\/?$/.test(path)) ||
        request.headers.has('Authorization') ||
        /(?:^|;\s*)(?:emdash-edit-mode|liftaris_setup)=/.test(cookie)) return request;
    const query = [...url.searchParams];
    if (query.length && !(query.length === 1 && query[0][0] === 'window' && query[0][1] === '1')) return request;
  }
  const headers = new Headers(request.headers);
  if (media) {
    headers.delete('Cookie');
    headers.delete('Authorization');
  } else {
    const remaining = cookie.split(';').filter(part => !/^\s*astro-session\s*=/.test(part)).join(';').trim();
    if (remaining) headers.set('Cookie', remaining);
    else headers.delete('Cookie');
  }
  return new Request(request, { headers, cf: request.cf }) as WorkerRequest;
}
