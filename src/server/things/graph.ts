import { ContentRepository, getI18nConfig, type Database } from 'emdash';
import { getRequestContext } from 'emdash/request-context';
import type { Kysely } from 'kysely';
import { normalizeData, type ThingData, type ThingRecord } from '../../lib/things/model';

/** Things save live. Include unpublished entries only for the workspace or initial publication. */
export async function policyGraph(db: Kysely<Database>, draftId?: string, includeUnpublished = false): Promise<ThingRecord[]> {
  const repo = new ContentRepository(db);
  const entries = [];
  let cursor: string | undefined;
  do {
    const page = await repo.findMany('things', { limit: 100, cursor });
    entries.push(...page.items); cursor = page.nextCursor;
  } while (cursor);
  const links = await readLinks(db);
  const groupToId = new Map(entries.map(e => [e.translationGroup ?? e.id, e.id]));
  const edges = indexLinks(links);
  const rows: ThingRecord[] = [];
  for (const e of entries) {
    if (!includeUnpublished && e.status !== 'published' && e.id !== draftId) continue;
    const refs = (field: string) => (edges.get(`things_${field}:${e.translationGroup ?? e.id}`) ?? [])
      .map(group => groupToId.get(group) ?? group);
    rows.push({ id: e.id, slug: e.slug ?? '', status: e.status,
      data: normalizeData(e.data), contents: refs('contents'), primaryFolder: refs('primary_folder')[0] ?? null, postId: refs('post')[0] ?? null });
  }
  return rows;
}

export async function postChoices(db: Kysely<Database>) {
  const repo = new ContentRepository(db);
  const posts: {id: string; title: string; slug: string; status: string}[] = [];
  let cursor: string | undefined;
  do {
    const page = await repo.findMany('posts', {limit:100, cursor});
    posts.push(...page.items.map(p => ({id:p.id, title:String(p.data.title ?? p.slug), slug:p.slug ?? p.id, status:p.status})));
    cursor = page.nextCursor;
  } while (cursor);
  return posts;
}

async function readLinks(db: Kysely<Database>) {
  return db.selectFrom('_emdash_content_references as edge')
    .innerJoin('_emdash_relations as relation', 'relation.id', 'edge.relation_id')
    .where('relation.slug', 'in', ['things_contents', 'things_primary_folder', 'things_post'])
    .select(['relation.slug', 'edge.parent_group', 'edge.child_group', 'edge.sort_order'])
    .orderBy('edge.sort_order')
    .execute();

}

function indexLinks(links: Awaited<ReturnType<typeof readLinks>>) {
  const edges = new Map<string, string[]>();
  for (const link of links) {
    const key = `${link.slug}:${link.parent_group}`;
    const children = edges.get(key) ?? [];
    children.push(link.child_group);
    edges.set(key, children);
  }
  return edges;
}

// EmDash stores published field values in ec_* columns and pending edits in
// revisions. Explicit columns avoid transferring article bodies across D1.
const metadataFields = [
  'name', 'kind', 'icon_type', 'emoji', 'image', 'width', 'height',
  'window_width', 'window_height', 'window_x', 'window_y', 'desktop',
  'default_open', 'sort_order', 'spawn_x', 'spawn_y', 'page_source',
  'path_override', 'background_image', 'background_size',
  'background_position', 'background_repeat',
] as const satisfies readonly (keyof Omit<ThingData, 'body'>)[];

type ContentColumns = {
  id: string; slug: string | null; status: string; translation_group: string | null;
  locale: string; deleted_at: string | null; created_at: string;
};
type ThingColumns = ContentColumns & Record<(typeof metadataFields)[number], unknown>;

export async function publicPostPaths(db: Kysely<Database>) {
  const locale = getRequestContext()?.locale ?? getI18nConfig()?.defaultLocale ?? 'en';
  return db.$extendTables<{ ec_posts: ContentColumns }>().selectFrom('ec_posts')
    .select(['id', 'slug']).where('deleted_at', 'is', null)
    .where('status', '=', 'published').where('locale', '=', locale).execute();
}

export async function publicGraph(db: Kysely<Database>): Promise<ThingRecord[]> {
  const content = db.$extendTables<{ ec_things: ThingColumns; ec_posts: ContentColumns }>();
  const locale = getRequestContext()?.locale ?? getI18nConfig()?.defaultLocale ?? 'en';
  const [entries, links] = await Promise.all([
    content.selectFrom('ec_things')
      .select(['id', 'slug', 'status', 'translation_group', ...metadataFields])
      .where('deleted_at', 'is', null).where('status', '=', 'published').where('locale', '=', locale)
      .orderBy('created_at', 'desc').orderBy('id', 'desc').execute(),
    readLinks(db),
  ]);
  const groupToId = new Map(entries.map(row => [row.translation_group ?? row.id, row.id]));
  const edges = indexLinks(links);
  const postGroups = [...new Set(entries.flatMap(row => edges.get(`things_post:${row.translation_group ?? row.id}`) ?? []))];
  const visiblePosts = new Map<string, string>();
  // Stay below D1's bind limit; never scan Post bodies merely to check visibility.
  for (let offset = 0; offset < postGroups.length; offset += 45) {
    const groups = postGroups.slice(offset, offset + 45);
    const posts = await content.selectFrom('ec_posts').select(['id', 'translation_group'])
      .where(eb => eb.or([eb('translation_group', 'in', groups), eb('id', 'in', groups)]))
      .where('deleted_at', 'is', null).where('status', '=', 'published').where('locale', '=', locale).execute();
    for (const post of posts) visiblePosts.set(post.translation_group ?? post.id, post.id);
  }
  return entries.flatMap(row => {
    const data: Record<string, unknown> = {};
    for (const field of metadataFields) {
      const value = row[field];
      if (value === null) continue;
      if (field === 'image' || field === 'background_image') {
        try { data[field] = typeof value === 'string' ? JSON.parse(value) : value; }
        catch { data[field] = value; }
      } else data[field] = ['desktop', 'default_open'].includes(field) ? Boolean(value) : value;
    }
    const refs = (field: string) => edges.get(`things_${field}:${row.translation_group ?? row.id}`) ?? [];
    const postId = visiblePosts.get(refs('post')[0]) ?? null;
    if (data.page_source === 'post' && !postId) return [];
    return [{ id: row.id, slug: row.slug ?? '', status: row.status, data: normalizeData(data),
      contents: refs('contents').map(group => groupToId.get(group) ?? group),
      primaryFolder: groupToId.get(refs('primary_folder')[0]) ?? refs('primary_folder')[0] ?? null,
      postId,
    }];
  });
}
