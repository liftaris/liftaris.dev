import { getEmDashEntry, type PortableTextBlock } from 'emdash';
import { mediaUrl, pathFor, type ThingData, type ThingRecord } from '../../lib/things/model';

export interface Page {
  title: string;
  windowTitle: string;
  icon: string;
  canonical?: string;
  restoreId?: string;
  source: ThingData['page_source'] | 'folder';
  article: { body: PortableTextBlock[]; title?: string; date?: string | null; titleAttributes?: Record<string, string> };
  content: { collection: string; id: string; slug: string };
}

export async function readPost(id: string) {
  const { entry, error } = await getEmDashEntry('posts', id);
  if (error && error.name !== 'LiveEntryNotFoundError') throw error;
  return entry;
}

export function postPage(post: NonNullable<Awaited<ReturnType<typeof readPost>>>): Page {
  return {
    title: post.data.title,
    windowTitle: post.data.title,
    icon: post.data.icon || '📝',
    canonical: `/blog/${post.id}`,
    source: 'post',
    article: { body: post.data.content ?? [], title: post.data.title, date: post.data.date, titleAttributes: post.edit.title },
    content: { collection: 'posts', id: post.data.id, slug: post.id },
  };
}

export async function thingPage(thing: ThingRecord, things: ThingRecord[], post?: Awaited<ReturnType<typeof readPost>>): Promise<Page> {
  if (thing.data.page_source === 'post' && thing.postId && !post) post = await readPost(thing.postId);
  let canonical: string | undefined;
  try { canonical = pathFor(thing, things) ?? undefined; } catch { /* Incomplete drafts are previewable. */ }
  return {
    ...(post ? postPage(post) : {
      title: thing.data.name,
      article: { body: thing.data.body as PortableTextBlock[] },
      content: { collection: 'things', id: thing.id, slug: thing.slug },
    }),
    windowTitle: thing.data.name,
    icon: (thing.data.icon_type === 'image' ? mediaUrl(thing.data.image) : thing.data.emoji) || '📄',
    canonical,
    restoreId: thing.id,
    source: thing.data.kind === 'folder' ? 'folder' : thing.data.page_source,
  };
}

