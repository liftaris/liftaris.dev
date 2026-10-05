import { getEmDashCollection, getEmDashEntry, getEmDashReferences } from 'emdash';
import { getRequestContext, runWithContext } from 'emdash/request-context';
import { normalizeData, pathFor, PAGE_SOURCES, type ThingRecord } from '../../lib/things/model';

/** Resolve fields and native relationships identically for routes, lists, and previews. */
export async function readThing(id: string, includeContents = false): Promise<ThingRecord | null> {
  const result = await getEmDashEntry('things', id, { references: {
    primary_folder: { limit: 1 }, post: { limit: 1 },
    ...(includeContents ? { contents: { limit: 100 } } : {}),
  } });
  if (result.error?.name === 'LiveEntryNotFoundError') return null;
  if (result.error) throw result.error;
  if (!result.entry) return null;
  const entry = result.entry;
  const refs = entry.references as Record<string, { entries: { data: { id: string } }[]; nextCursor?: string }> | undefined;
  const data = normalizeData(entry.data as unknown as Record<string, unknown>);
  const postId = refs?.post?.entries[0]?.data.id ?? null;
  if (data.page_source === 'post' && !postId) return null;
  const contents = refs?.contents?.entries.map(r => r.data.id) ?? [];
  let cursor = refs?.contents?.nextCursor;
  while (cursor) {
    const page = await getEmDashReferences('things', entry.data.id, 'contents', { limit: 100, cursor });
    if (page.error) throw page.error;
    contents.push(...page.entries.map(r => String(r.data.id)));
    cursor = page.nextCursor;
  }
  return { id: entry.data.id, slug: entry.data.slug || entry.id, status: entry.data.status,
    data, contents, postId, primaryFolder: refs?.primary_folder?.entries[0]?.data.id ?? null };
}

/** Read independent entries concurrently instead of paying a D1 round trip per Thing.
 * Select only relevant relations and consume every contents cursor.
 */
export async function readThings(mode: 'request' | 'published' = 'request', options: { includeContents?: boolean } = {}): Promise<ThingRecord[]> {
  const read = async () => {
    const rows: ThingRecord[] = [];
    let cursor: string | undefined;
    do {
      const page = await getEmDashCollection('things', { limit: 100, cursor });
      if (page.error) throw page.error;
      const resolved = await Promise.all(page.entries.map(async (summary): Promise<ThingRecord | null> => {
        const summaryData = summary.data as unknown as Record<string, unknown>;
        return readThing(summary.data.id, options.includeContents !== false && summaryData.kind === 'folder');
      }));
      rows.push(...resolved.filter((row): row is ThingRecord => row !== null));
      cursor = page.nextCursor;
    } while (cursor);
    return rows;
  };
  if (mode === 'request') return read();
  return runWithContext({ ...getRequestContext(), editMode: false, preview: undefined }, read);
}

/** Resolve a normal page in O(primary-folder depth), not O(all Things).
 * Native slugs are unique within the collection; validate the full canonical
 * path so an unrelated page with the same final segment is never served.
 */
export async function readThingAtPath(path: string): Promise<{ thing: ThingRecord; things: ThingRecord[] } | null> {
  return runWithContext({ ...getRequestContext(), editMode: false, preview: undefined }, async () => {
    const resolve = async (id: string) => {
      const things: ThingRecord[] = [];
      const seen = new Set<string>();
      let next: string | null = id;
      while (next) {
        const thing = await readThing(next);
        if (!thing || seen.has(thing.id)) return null;
        seen.add(thing.id);
        things.push(thing);
        next = thing.data.path_override ? null : thing.primaryFolder;
      }
      const thing = things[0];
      return thing && pathFor(thing, things) === path ? {thing,things} : null;
    };
    const builtin = Object.entries(PAGE_SOURCES).find(([, route]) => route === path)?.[0];
    if (builtin) {
      const matches = await getEmDashCollection('things', { where: { kind: 'page', page_source: builtin }, limit: 1 });
      if (matches.error) throw matches.error;
      return matches.entries[0] ? resolve(matches.entries[0].data.id) : null;
    }
    const slug = path.split('/').at(-1);
    if (!slug) return null;
    const normal = await resolve(slug);
    if (normal) return normal;
    const override = await getEmDashCollection('things', { where: { path_override: path }, limit: 1 });
    if (override.error) throw override.error;
    return override.entries[0] ? resolve(override.entries[0].data.id) : null;
  });
}
