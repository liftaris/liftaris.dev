import { EmDashClient, type ContentItem } from 'emdash/client';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { homedir } from 'node:os';
import { join } from 'node:path';

const { values } = parseArgs({ options: {
  origin: { type: 'string' }, id: { type: 'string' }, directory: { type: 'string' },
  apply: { type: 'boolean', default: false }, rollback: { type: 'boolean', default: false },
} });
if (!values.origin || !values.id || !values.directory || (values.apply && values.rollback)) {
  throw new Error('Use --origin URL --id THING_ID --directory BACKUP_DIRECTORY [--apply | --rollback].');
}
const origin = new URL(values.origin);
if ((origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname)) || origin.pathname !== '/' || origin.search || origin.username || origin.password) throw new Error('Use an HTTPS origin without credentials or a path (HTTP is allowed for localhost).');
let token = process.env.EMDASH_TOKEN;
let refreshToken: string | undefined;
if (!token) {
  const credentials = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'emdash/auth.json');
  try {
    const saved = JSON.parse(await readFile(credentials, 'utf8'))[origin.origin];
    token = saved?.accessToken;
    refreshToken = saved?.refreshToken;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
if (!token) throw new Error('Log in with emdash login or set EMDASH_TOKEN to an owner token; do not put tokens in command arguments.');
const client = new EmDashClient({ baseUrl: origin.origin, token, refreshToken,
  onTokenRefresh: accessToken => { token = accessToken; } });
if ((await client.collection('things')).supports.includes('drafts')) {
  throw new Error('This migration requires Things to save live. Resolve a revision-aware publishing workflow before changing a collection with drafts enabled.');
}
const directory = values.directory;
await mkdir(directory, { recursive: true, mode: 0o700 });
type Manifest = {
  origin: string; id: string; before: ContentItem; revisions: unknown;
  images: { hash: string; source: string; file: string; media?: { id: string; storageKey: string } }[];
  after?: ContentItem; rolledBack?: boolean; needsVerification?: boolean;
};
const path = `${directory}/manifest.json`;
let manifest: Manifest;
try { manifest = JSON.parse(await readFile(path, 'utf8')); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  if (values.rollback) throw new Error('Rollback requires an existing manifest.');
  const before = await client.get('things', values.id, { raw: true });
  if (!before._rev || before.status !== 'published' || before.draftRevisionId) {
    throw new Error('Migrate a published Thing with no pending draft and a current revision token.');
  }
  // Preserve revision data, even though this migration never rewrites history.
  async function api(path: string) {
    const response = await fetch(new URL(`/_emdash/api/${path}`, origin), { redirect: 'error',
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Revision backup failed: HTTP ${response.status}`);
    return (await response.json()).data;
  }
  const history = await api(`content/things/${encodeURIComponent(before.id)}/revisions?limit=100`);
  const rows = history.items;
  if (!Array.isArray(rows) || history.total !== rows.length) throw new Error('Export the full revision history before migrating this entry.');
  const revisions = [];
  for (const row of rows) revisions.push(await api(`revisions/${encodeURIComponent(row.id)}`));
  manifest = { origin: origin.origin, id: before.id, before, revisions, images: [] };
  const sources = new Set<string>();
  function collect(value: unknown) {
    if (typeof value === 'string' && value.startsWith('data:image/png;base64,')) sources.add(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  }
  collect(before.data.body);
  for (const source of sources) {
    const bytes = Buffer.from(source.slice('data:image/png;base64,'.length), 'base64');
    if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid embedded PNG.');
    const hash = createHash('sha256').update(bytes).digest('hex');
    const file = `${hash}.png`;
    await writeFile(`${directory}/${file}`, bytes, { mode: 0o600 });
    manifest.images.push({ hash, source, file });
  }
}
if (manifest.origin !== origin.origin || ![manifest.id, manifest.before.slug].includes(values.id)) throw new Error('Backup target differs from the requested origin/Thing.');
async function save() {
  await writeFile(`${path}.tmp`, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
  await rename(`${path}.tmp`, path);
}
await save();
const current = await client.get('things', manifest.id, { raw: true });
if (values.rollback) {
  if (manifest.rolledBack) throw new Error('Rollback was already applied; inspect the manifest before another write.');
  if (!manifest.after?._rev || current._rev !== manifest.after._rev || current.draftRevisionId) throw new Error('Entry changed since migration; rollback stopped.');
  try {
    await client.update('things', manifest.id, { _rev: current._rev, data: { body: manifest.before.data.body } });
  } catch (error) {
    const saved = await client.get('things', manifest.id, { raw: true });
    if (saved._rev !== current._rev && JSON.stringify(saved.data.body) === JSON.stringify(manifest.before.data.body)) {
      manifest.rolledBack = true;
      manifest.needsVerification = true;
      await save();
      throw new Error('The original body was restored, but the CMS returned an error afterwards. Verify cache invalidation.', { cause: error });
    }
    throw error;
  }
  manifest.rolledBack = true;
  await save();
  console.log('Restored the original body. Uploaded media is retained for review.');
} else if (values.apply) {
  if (!manifest.images.length) { console.log('No embedded PNGs to migrate.'); process.exit(0); }
  if (manifest.rolledBack) throw new Error('Use a new backup directory after rollback.');
  if (manifest.after) {
    if (current._rev !== manifest.after._rev) throw new Error('Entry changed after migration.');
    if (manifest.needsVerification) throw new Error('The CMS stored the change but returned an error afterwards. Verify cache invalidation before accepting it, or use --rollback.');
    console.log('Migration already complete.');
  } else {
    if (current._rev !== manifest.before._rev || current.draftRevisionId) throw new Error('Entry changed since backup; migration stopped.');
    for (const image of manifest.images) {
      const bytes = await readFile(`${directory}/${image.file}`);
      if (createHash('sha256').update(bytes).digest('hex') !== image.hash) throw new Error('Backup image hash mismatch.');
      if (!image.media) {
        // The HTTP DTO uses storageKey (the 1.2 client declaration calls it key).
        const uploaded = await client.mediaUpload(bytes, `pixel-art-${image.hash}.png`, { contentType: 'image/png' }) as unknown as { id: string; storageKey: string };
        if (typeof uploaded.id !== 'string' || typeof uploaded.storageKey !== 'string') throw new Error('Unexpected media upload response.');
        image.media = uploaded;
        await save();
      }
      const response = await fetch(new URL(`/_emdash/api/media/file/${encodeURIComponent(image.media.storageKey)}`, origin), { redirect: 'error', signal: AbortSignal.timeout(20_000) });
      if (!response.ok || createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex') !== image.hash) throw new Error('Uploaded image verification failed.');
    }
    const mediaBySource = new Map(manifest.images.map(image => [image.source, image.media!]));
    const replacements = new Map(manifest.images.map(image => [image.source, `/_emdash/api/media/file/${encodeURIComponent(image.media!.storageKey)}`]));
    function replace(value: unknown): unknown {
      if (typeof value === 'string') return replacements.get(value) ?? value;
      if (Array.isArray(value)) return value.map(replace);
      if (value && typeof value === 'object') {
        const result = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replace(child)]));
        const source = (value as Record<string, unknown>).url ?? (value as Record<string, unknown>).src;
        const media = typeof source === 'string' ? mediaBySource.get(source) : undefined;
        if (media) {
          result._ref = media.id;
          result.provider = 'local';
          result.meta = { ...(result.meta as object | undefined), storageKey: media.storageKey };
        }
        return result;
      }
      return value;
    }
    // Only URLs change. Block keys, captions, alt text, dimensions and all other
    // fields remain intact. Native updates enforce locks, _rev, and cache purges.
    const body = replace(manifest.before.data.body);
    try {
      manifest.after = await client.update('things', manifest.id, { _rev: current._rev, data: { body } });
      await save();
    } catch (error) {
      // A purge can fail after the database commit. Preserve a rollback token
      // only if the resulting body and all other fields match this operation.
      const saved = await client.get('things', manifest.id, { raw: true });
      if (saved._rev !== current._rev && !saved.draftRevisionId && saved.status === current.status &&
          JSON.stringify(saved.data) === JSON.stringify({ ...current.data, body })) {
        manifest.after = saved;
        manifest.needsVerification = true;
        await save();
        throw new Error('The CMS saved the body but failed afterwards (possibly cache invalidation). Rollback information is saved; inspect before continuing.', { cause: error });
      }
      throw error;
    }
    const verified = await client.get('things', manifest.id, { raw: true });
    if (JSON.stringify(verified.data.body) !== JSON.stringify(body)) throw new Error('Saved body differs; inspect the manifest before retrying.');
    manifest.after = verified;
    await save();
    console.log(`Migrated ${manifest.images.length} PNGs. Backup and rollback manifest: ${path}`);
  }
} else console.log(`Prepared ${manifest.images.length} PNGs at ${path}. Review, then rerun with --apply.`);
