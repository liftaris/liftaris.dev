import { getEmDashCollection, getEmDashEntry, getEmDashReferences } from 'emdash';
import { getRequestContext, runWithContext } from 'emdash/request-context';
import { normalizeData, type ThingRecord } from '../../lib/things/model';

/** Every page is consumed: collection/ref defaults are deliberately small in EmDash. */
export async function readThings(mode: 'request' | 'published' | 'editor' = 'request'): Promise<ThingRecord[]> {
  const read = async () => {
    const rows: ThingRecord[] = [];
    let cursor: string | undefined;
    do {
      const page = await getEmDashCollection('things', { limit: 100, cursor });
      if (page.error) throw page.error;
      for (const summary of page.entries) {
        const result = await getEmDashEntry('things', summary.data.id, { references: { contents: true, primary_folder: true, post: true } });
        if (result.error) throw result.error;
        if (!result.entry) continue;
        const entry = result.entry;
        const refs = entry.references as Record<string, { entries: { data: {id: string} }[]; nextCursor?: string }> | undefined;
        const postId = refs?.post?.entries[0]?.data.id ?? null;
        if ((entry.data as unknown as Record<string,unknown>).page_source === 'post' && !postId) continue;
        const contents = refs?.contents?.entries.map(r => r.data.id) ?? [];
        let next = refs?.contents?.nextCursor;
        while (next) {
          const rest = await getEmDashReferences('things', entry.data.id, 'contents', { limit: 100, cursor: next });
          if (rest.error) throw rest.error;
          contents.push(...rest.entries.map(r => String(r.data.id))); next = rest.nextCursor;
        }
        rows.push({ id: entry.data.id, slug: entry.data.slug || entry.id, status: entry.data.status,
          data: normalizeData(entry.data as unknown as Record<string, unknown>), contents,
          postId, primaryFolder: refs?.primary_folder?.entries[0]?.data.id ?? null });
      }
      cursor = page.nextCursor;
    } while (cursor);
    return rows;
  };
  if (mode === 'request') return read();
  return runWithContext({ ...getRequestContext(), editMode: mode === 'editor', preview: undefined }, read);
}
export { sceneThings } from '../../lib/things/scene';
