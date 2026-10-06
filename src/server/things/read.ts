import { ContentRepository, getEmDashCollection, getEmDashEntry, getEmDashReferences, type ContentEntry, type InferCollectionData } from 'emdash';
import { getDb } from 'emdash/runtime';
import { getRequestContext, runWithContext } from 'emdash/request-context';
import { normalizeData, pathFor, PAGE_SOURCES, type ThingRecord } from '../../lib/things/model';
import { policyGraph } from './graph';

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
  const thing = thingRecord(entry);
  if (thing.data.page_source === 'post' && !thing.postId) return null;
  const contents = thing.contents;
  let cursor = entry.references?.contents?.nextCursor;
  while (cursor) {
    const page = await getEmDashReferences('things', entry.data.id, 'contents', { limit: 100, cursor });
    if (page.error) throw page.error;
    contents.push(...page.entries.map(r => String(r.data.id)));
    cursor = page.nextCursor;
  }
  return thing;
}

function thingRecord(entry: ContentEntry<InferCollectionData<'things'>, Partial<Record<'contents' | 'post' | 'primary_folder', { entries: { data: { id: string } }[] }>>>): ThingRecord {
  const refs = entry.references;
  return {
    id: entry.data.id, slug: entry.data.slug || entry.id, status: entry.data.status,
    data: normalizeData({ ...entry.data }),
    contents: refs?.contents?.entries.map(row => String(row.data.id)) ?? [],
    postId: refs?.post?.entries[0] ? String(refs.post.entries[0].data.id) : null,
    primaryFolder: refs?.primary_folder?.entries[0] ? String(refs.primary_folder.entries[0].data.id) : null,
  };
}

/** Bulk read all Things and relations in 2-3 queries, avoiding the N+1 D1 query storm. */
export async function readThings(mode: 'request' | 'published' = 'request'): Promise<ThingRecord[]> {
  const fetchThings = async () => {
    const db = await getDb();
    const context = getRequestContext();
    const isRequestMode = mode === 'request';
    const includeUnpublished = isRequestMode && context?.editMode === true;
    const draftId = isRequestMode ? context?.preview?.id : undefined;

    const all = await policyGraph(db, draftId, includeUnpublished);
    const postIds = all
      .filter(r => r.data.page_source === 'post' && r.postId)
      .map(r => r.postId as string);

    let visiblePostIds: Set<string> | null = null;
    if (postIds.length > 0) {
      const postRepo = new ContentRepository(db);
      const posts: { id: string; status: string }[] = [];
      let cursor: string | undefined;
      do {
        const page = await postRepo.findMany('posts', { limit: 100, cursor });
        posts.push(...page.items.map(p => ({ id: p.id, status: p.status })));
        cursor = page.nextCursor;
      } while (cursor);
      visiblePostIds = new Set(
        posts
          .filter(p => includeUnpublished || p.status === 'published')
          .map(p => p.id)
      );
    }

    return all.filter(r => {
      if (r.data.page_source === 'post') {
        return Boolean(r.postId && visiblePostIds?.has(r.postId));
      }
      return true;
    });
  };
  if (mode === 'request') return fetchThings();
  return runWithContext({ ...getRequestContext(), editMode: false, preview: undefined }, fetchThings);
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
      // The collection result already contains all page fields. Built-in paths
      // are independent of folder ancestry, so do not reread the entry/relations.
      const thing = matches.entries[0] && thingRecord(matches.entries[0]);
      return thing ? { thing, things: [thing] } : null;
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
