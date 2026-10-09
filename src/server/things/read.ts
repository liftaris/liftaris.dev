import { ContentRepository, getEmDashEntry, getEmDashReferences, type ContentEntry, type InferCollectionData } from 'emdash';
import { getDb } from 'emdash/runtime';
import { getRequestContext, runWithContext } from 'emdash/request-context';
import { normalizeData, pathFor, type ThingRecord } from '../../lib/things/model';
import { policyGraph, publicGraph } from './graph';
import { readOnce } from './request-cache';

/** Resolve fields and native relationships identically for routes, lists, and previews. */
export function readThing(id: string, includeContents = false): Promise<ThingRecord | null> {
  return readOnce(`thing:${id}:${includeContents}`, () => loadThing(id, includeContents));
}

async function loadThing(id: string, includeContents: boolean): Promise<ThingRecord | null> {
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
    const draftId = isRequestMode && context?.preview?.collection === 'things' ? context.preview.id : undefined;
    if (!includeUnpublished && !draftId) return publicGraph(db);

    const all = await policyGraph(db, draftId, includeUnpublished);
    const postIds = all
      .filter(r => r.data.page_source === 'post' && r.postId)
      .map(r => r.postId as string);

    let visiblePostIds: Set<string> | null = null;
    if (postIds.length > 0) {
      const postRepo = new ContentRepository(db);
      const posts = [...(await postRepo.findManyByIds('posts', [...new Set(postIds)])).values()];
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
  if (mode === 'request') return readOnce('things:request', fetchThings);
  return runWithContext({ ...getRequestContext(), editMode: false, preview: undefined }, () => readOnce('things:published', fetchThings));
}

/** Resolve ancestry from metadata, then load only the selected page body. */
export async function readThingAtPath(path: string): Promise<{ thing: ThingRecord; things: ThingRecord[] } | null> {
  return runWithContext({ ...getRequestContext(), editMode: false, preview: undefined }, async () => {
    const things = await readThings('published');
    const match = things.find(thing => {
      try { return pathFor(thing, things) === path; }
      catch { return false; } // An unavailable ancestor cannot expose a child route.
    });
    if (!match) return null;
    let thing = match;
    if (match.data.kind === 'page' && match.data.page_source === 'content') {
      // Relationships are already resolved by the metadata graph. Ask the
      // native loader only for this entry's published fields/body.
      const result = await getEmDashEntry('things', match.id);
      if (result.error?.name === 'LiveEntryNotFoundError') return null;
      if (result.error) throw result.error;
      if (!result.entry) return null;
      thing = { ...match, data: normalizeData({ ...result.entry.data }) };
    }
    return thing ? { thing, things } : null;
  });
}
