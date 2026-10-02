import { ContentRepository, RevisionRepository, type Database } from 'emdash';
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
    .select(['relation.slug', 'edge.parent_group', 'edge.child_group', 'edge.sort_order']).orderBy('edge.sort_order').execute();
  const groupToId = new Map(entries.map(e => [e.translationGroup ?? e.id, e.id]));
  const rows: ThingRecord[] = [];
  for (const e of entries) {
    if (!allDrafts && e.status !== 'published' && e.id !== draftId) continue;
    const revision = (allDrafts || e.id === draftId) && e.draftRevisionId ? await new RevisionRepository(db).findById(e.draftRevisionId) : null;
    const staged = revision?.data._references as Record<string, string[]> | undefined;
    const refs = (field: string) => (staged?.[field] ?? links.filter(l => l.slug === `things_${field}` && l.parent_group === (e.translationGroup ?? e.id)).map(l => l.child_group)).map(g => groupToId.get(g) ?? g);
    rows.push({ id: e.id, slug: typeof revision?.data._slug === 'string' ? revision.data._slug : e.slug ?? '', status: e.status,
      data: normalizeData({ ...e.data, ...revision?.data }), contents: refs('contents'), primaryFolder: refs('primary_folder')[0] ?? null, postId: refs('post')[0] ?? null });
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
