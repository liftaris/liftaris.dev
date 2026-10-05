import { ContentRepository, type Database } from 'emdash';
import type { Kysely } from 'kysely';
import { normalizeData, type ThingRecord } from '../../lib/things/model';

/** Server policy snapshot. Only the candidate's draft is overlaid for publication. */
export async function policyGraph(db: Kysely<Database>, draftId?: string, allDrafts = false): Promise<ThingRecord[]> {
  const repo = new ContentRepository(db);
  const entries = [];
  let cursor: string | undefined;
  do {
    const page = await repo.findMany('things', { limit: 100, cursor });
    entries.push(...page.items); cursor = page.nextCursor;
  } while (cursor);
  const links = await db.selectFrom('_emdash_content_references as edge')
    .innerJoin('_emdash_relations as relation', 'relation.id', 'edge.relation_id')
    .where('relation.slug', 'in', ['things_contents', 'things_primary_folder', 'things_post'])
    .select(['relation.slug', 'edge.parent_group', 'edge.child_group', 'edge.sort_order'])
    .orderBy('edge.sort_order')
    .execute();

  const neededRevisionIds = entries
    .filter(e => (allDrafts || e.id === draftId) && Boolean(e.draftRevisionId))
    .map(e => e.draftRevisionId as string);

  const revisionMap = new Map<string, { _slug?: string; _references?: Record<string, string[]>; [key: string]: unknown }>();
  if (neededRevisionIds.length > 0) {
    const revRows = await db.selectFrom('revisions')
      .select(['id', 'data'])
      .where('id', 'in', neededRevisionIds)
      .execute();
    for (const row of revRows) {
      revisionMap.set(row.id, JSON.parse(row.data));
    }
  }

  const groupToId = new Map(entries.map(e => [e.translationGroup ?? e.id, e.id]));
  const rows: ThingRecord[] = [];
  for (const e of entries) {
    if (!allDrafts && e.status !== 'published' && e.id !== draftId) continue;
    const revisionData = (allDrafts || e.id === draftId) && e.draftRevisionId ? revisionMap.get(e.draftRevisionId) : null;
    const staged = revisionData?._references as Record<string, string[]> | undefined;
    const refs = (field: string) => (staged?.[field] ?? links.filter(l => l.slug === `things_${field}` && l.parent_group === (e.translationGroup ?? e.id)).map(l => l.child_group)).map(g => groupToId.get(g) ?? g);
    rows.push({ id: e.id, slug: typeof revisionData?._slug === 'string' ? revisionData._slug : e.slug ?? '', status: e.status,
      data: normalizeData({ ...e.data, ...revisionData }), contents: refs('contents'), primaryFolder: refs('primary_folder')[0] ?? null, postId: refs('post')[0] ?? null });
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
