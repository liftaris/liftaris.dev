import { expect, test } from 'bun:test';
import { windowCacheControl } from './window-cache';

const request = (query = '?window=1', headers = {}, method = 'GET') => new Request(`https://portfolio.test/projects${query}`, { headers, method });
test('embedded public HTML can reuse native prefetch for only 30 seconds in the browser', () => {
  expect(windowCacheControl(request(), false)).toBe('private, max-age=30');
  // Gift visitors have native sessions too; cache stays private and varies by Cookie.
  expect(windowCacheControl(request('?window=1', { cookie: 'astro-session=visitor' }), false)).toBe('private, max-age=30');
});
test('signed previews, editing and bearer-authenticated requests never cache embedded HTML', () => {
  for (const r of [request('?_preview=signed&window=1'), request('?_edit&window=1'),
    request('?window=1', { cookie: 'emdash-edit-mode=true' }),
    request('?window=1', { authorization: 'Bearer token' }), request('?window=1', {}, 'POST')]) {
    expect(windowCacheControl(r, false)).toBe('private, no-store');
  }
  expect(windowCacheControl(request(), true)).toBe('private, no-store');
});
