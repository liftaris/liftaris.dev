import { getEmDashCollection, getEmDashEntry, getEmDashReferences } from 'emdash';
import { getRequestContext, runWithContext } from 'emdash/request-context';
import { normalizeData, pathFor, type ThingRecord } from '../../lib/things/model';

let thingsCache: { key: string; rows: ThingRecord[]; expiresAt: number } | null = null;
let editCache: { key: string; rows: ThingRecord[]; expiresAt: number } | null = null;

export function invalidateThingsCache() {
  thingsCache = null;
  editCache = null;
}

/** Read independent entries concurrently instead of paying a D1 round trip per Thing.
 * Select only relevant relations and consume every contents cursor.
 */
export async function readThings(mode: 'request' | 'published' | 'editor' = 'request', options: { includeContents?: boolean } = {}): Promise<ThingRecord[]> {
  const context = getRequestContext();
  const isEditing = mode === 'editor' || context?.editMode === true || Boolean(context?.preview);
  const cacheKey = options.includeContents !== false ? 'full' : 'routing';

  if (!isEditing && thingsCache && thingsCache.key === cacheKey && Date.now() < thingsCache.expiresAt) {
    return thingsCache.rows;
  }
  if (isEditing && editCache && editCache.key === cacheKey && Date.now() < editCache.expiresAt) {
    return editCache.rows;
  }

  const read = async () => {
    const rows: ThingRecord[] = [];
    let cursor: string | undefined;
    do {
      const page = await getEmDashCollection('things', { limit: 100, cursor });
      if (page.error) throw page.error;
      const resolved = await Promise.all(page.entries.map(async (summary): Promise<ThingRecord | null> => {
        const summaryData = summary.data as unknown as Record<string, unknown>;
        const result = await getEmDashEntry('things', summary.data.id, { references: {
          primary_folder: { limit: 1 },
          ...(options.includeContents !== false && summaryData.kind === 'folder' ? { contents: { limit: 100 } } : {}),
          ...(summaryData.page_source === 'post' ? { post: { limit: 1 } } : {}),
        } });
        if (result.error) throw result.error;
        if (!result.entry) return null;
        const entry = result.entry;
        const refs = entry.references as Record<string, { entries: { data: {id: string} }[]; nextCursor?: string }> | undefined;
        const postId = refs?.post?.entries[0]?.data.id ?? null;
        if ((entry.data as unknown as Record<string,unknown>).page_source === 'post' && !postId) return null;
        const contents = refs?.contents?.entries.map(r => r.data.id) ?? [];
        let next = refs?.contents?.nextCursor;
        while (next) {
          const rest = await getEmDashReferences('things', entry.data.id, 'contents', { limit: 100, cursor: next });
          if (rest.error) throw rest.error;
          contents.push(...rest.entries.map(r => String(r.data.id))); next = rest.nextCursor;
        }
        return { id: entry.data.id, slug: entry.data.slug || entry.id, status: entry.data.status,
          data: normalizeData(entry.data as unknown as Record<string, unknown>), contents,
          postId, primaryFolder: refs?.primary_folder?.entries[0]?.data.id ?? null };
      }));
      rows.push(...resolved.filter((row): row is ThingRecord => row !== null));
      cursor = page.nextCursor;
    } while (cursor);
    if (!isEditing) {
      thingsCache = { key: cacheKey, rows, expiresAt: Date.now() + 30_000 };
    } else {
      editCache = { key: cacheKey, rows, expiresAt: Date.now() + 5_000 };
    }
    return rows;
  };
  if (mode === 'request') return read();
  return runWithContext({ ...getRequestContext(), editMode: mode === 'editor', preview: undefined }, read);
}
export { sceneThings } from '../../lib/things/scene';

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
        const result = await getEmDashEntry('things', next, { references: { primary_folder: { limit: 1 }, post: { limit: 1 } } });
        if (result.error?.name === 'LiveEntryNotFoundError') return null;
        if (result.error) throw result.error;
        if (!result.entry) return null;
        const entry = result.entry;
        if (seen.has(entry.data.id)) return null;
        seen.add(entry.data.id);
        const refs = entry.references as Record<string, { entries: { data: {id: string} }[] }> | undefined;
        const data = normalizeData(entry.data as unknown as Record<string, unknown>);
        const postId = refs?.post?.entries[0]?.data.id ?? null;
        if (data.page_source === 'post' && !postId) return null;
        const thing: ThingRecord = {id:entry.data.id,slug:entry.data.slug || entry.id,status:entry.data.status,data,
          contents:[],primaryFolder:refs?.primary_folder?.entries[0]?.data.id ?? null,postId};
        things.push(thing);
        next = data.path_override ? null : thing.primaryFolder;
      }
      const thing = things[0];
      return thing && pathFor(thing, things) === path ? {thing,things} : null;
    };
    const slug = path.split('/').at(-1);
    if (!slug) return null;
    const normal = await resolve(slug);
    if (normal) return normal;
    const override = await getEmDashCollection('things', { where: { path_override: path }, limit: 1 });
    if (override.error) throw override.error;
    return override.entries[0] ? resolve(override.entries[0].data.id) : null;
  });
}
