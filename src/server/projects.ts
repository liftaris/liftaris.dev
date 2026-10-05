import { PROJECTS } from '../../data/portfolio';

/** Cache public counter responses at Cloudflare for 12 hours, independently of CMS pages. */
async function readCounter(counter: { url: string; field: string; suffix: string }, origin: string): Promise<string> {
  try {
    const cache = await caches.open('project-counters');
    const key = new URL('/project-counter', origin);
    key.search = new URLSearchParams(counter).toString();
    const cached = await cache.match(key.href);
    if (cached) return cached.text();
    const response = await fetch(counter.url, {
      headers: { Accept: 'application/json', 'User-Agent': 'liftaris.dev' },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`Counter returned ${response.status}`);
    const data = await response.json();
    const count = data && typeof data === 'object' && counter.field in data
      ? Reflect.get(data, counter.field) : undefined;
    if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) throw new Error('Invalid counter response');
    const label = ` · ${count.toLocaleString('en-US')}${counter.suffix}`;
    await cache.put(key.href, new Response(label, { headers: { 'Cache-Control': 'public, max-age=43200' } }));
    return label;
  } catch (error) {
    console.warn('Project counter unavailable', { url: counter.url, error: String(error) });
    return '';
  }
}

export function readProjects(origin: string) {
  return Promise.all(PROJECTS.map(async project => ({
    ...project,
    links: await Promise.all(project.links.map(async link => ({
      ...link, label: link.label + (link.counter ? await readCounter(link.counter, origin) : ''),
    }))),
  })));
}
