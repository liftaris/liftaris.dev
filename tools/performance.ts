import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  origin: { type: 'string', default: 'https://www.liftaris.dev' },
  version: { type: 'string' }, warm: { type: 'boolean', default: false },
  samples: { type: 'string', default: '3' }, out: { type: 'string' },
} });
const origin = new URL(values.origin!);
if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname)) throw new Error('Use HTTPS.');
if (origin.pathname !== '/' || origin.search || origin.username || origin.password) throw new Error('Provide an origin, without a path or credentials.');
if (values.warm && (!values.version || process.env.PERF_COOKIE)) throw new Error('Warming requires --version and no PERF_COOKIE.');
const samples = values.warm ? 2 : Number(values.samples);
if (!Number.isInteger(samples) || samples < 1 || samples > 20) throw new Error('Use 1–20 samples.');

function publicURL(raw: string): URL {
  const url = new URL(raw, origin);
  if (![origin.origin, 'https://www.liftaris.dev'].includes(url.origin) || url.username || url.password || url.hash ||
      /^\/(?:_emdash|admin|things-preview|api)(?:\/|$)/.test(decodeURIComponent(url.pathname)) || url.search) {
    throw new Error(`Unexpected sitemap URL: ${url.pathname}`);
  }
  // Preview/local builds still advertise the production canonical site URL.
  // Validate it first, then keep every probe on the explicitly selected origin.
  url.protocol = origin.protocol;
  url.host = origin.host;
  return url;
}
async function request(url: URL) {
  const started = performance.now();
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20_000),
    headers: process.env.PERF_COOKIE ? { Cookie: process.env.PERF_COOKIE } : {} });
  const headersMs = performance.now() - started;
  if (values.version && response.headers.get('X-Worker-Version') !== values.version) {
    await response.body?.cancel();
    throw new Error('Deployed Worker version does not match --version.');
  }
  const body = await response.text();
  if (response.status !== 200) throw new Error(`${url.pathname}: HTTP ${response.status}`);
  return { body, sample: { url: url.href, status: response.status,
    headersMs: Math.round(headersMs), totalMs: Math.round(performance.now() - started),
    decodedBytes: Buffer.byteLength(body), cache: response.headers.get('CF-Cache-Status'),
    age: response.headers.get('Age'), ray: response.headers.get('CF-Ray'),
    version: response.headers.get('X-Worker-Version'), serverTiming: response.headers.get('Server-Timing') } };
}
const sitemap = await request(new URL('/sitemap.xml', origin));
const urls = new Set([new URL('/', origin).href, new URL('/sitemap.xml', origin).href]);
for (const match of sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const url = publicURL(match[1].replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&lt;', '<'));
  urls.add(url.href);
  url.searchParams.set('window', '1');
  urls.add(url.href);
}
urls.add(new URL('/api/github/contributions', origin).href);
if (urls.size > 100) throw new Error('Sitemap exceeds the 100-URL warming budget.');
const queue = [...urls];
const results: { url: string; samples: Awaited<ReturnType<typeof request>>['sample'][]; error?: string }[] = [];
await Promise.all(Array.from({ length: 2 }, async () => {
  for (let raw; (raw = queue.shift());) {
    const row: (typeof results)[number] = { url: raw, samples: [] };
    results.push(row);
    for (let index = 0; index < samples; index++) {
      for (let attempt = 0; attempt < (values.warm ? 2 : 1); attempt++) {
        try { row.samples.push((await request(new URL(raw))).sample); break; }
        catch (error) {
          if (attempt === (values.warm ? 1 : 0)) row.error = error instanceof Error ? error.message : String(error);
        }
      }
      if (row.error) break;
    }
  }
}));
const sorted = results.flatMap(row => row.samples.map(sample => sample.headersMs)).sort((a, b) => a - b);
const report = { at: new Date().toISOString(), origin: origin.origin, authenticated: Boolean(process.env.PERF_COOKIE),
  mode: values.warm ? 'warm' : 'measure', medianHeadersMs: sorted[Math.floor(sorted.length / 2)],
  p95HeadersMs: sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)], results };
if (values.out) await Bun.write(values.out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (results.some(row => row.error || (values.warm && !['HIT', 'UPDATING'].includes(row.samples.at(-1)?.cache ?? '')))) process.exitCode = 1;
