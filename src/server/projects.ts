import { PROJECTS } from '../../data/portfolio';

/** Cache public counter responses at Cloudflare for 12 hours, independently of CMS pages. */
async function readCounter(counter: { url: string; field: string; suffix: string }): Promise<string> {
  try {
    const response = await fetch(counter.url, {
      headers: { Accept: 'application/json', 'User-Agent': 'liftaris.dev' },
      signal: AbortSignal.timeout(3000),
      cf: { cacheEverything: true, cacheTtlByStatus: { '200': 43_200, '400-599': -1 } },
    });
    if (!response.ok) throw new Error(`Counter returned ${response.status}`);
    const data = await response.json();
    const count = data && typeof data === 'object' && counter.field in data
      ? Reflect.get(data, counter.field) : undefined;
    if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) throw new Error('Invalid counter response');
    return ` · ${count.toLocaleString('en-US')}${counter.suffix}`;
  } catch (error) {
    console.warn('Project counter unavailable', { url: counter.url, error: String(error) });
    return '';
  }
}

export function readProjects() {
  return Promise.all(PROJECTS.map(async project => ({
    ...project,
    links: await Promise.all(project.links.map(async link => ({
      ...link, label: link.label + (link.counter ? await readCounter(link.counter) : ''),
    }))),
  })));
}
