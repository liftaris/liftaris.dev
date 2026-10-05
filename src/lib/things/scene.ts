import { mediaUrl, pathFor, type ThingRecord } from './model';
import type { ThingData } from './model';

export type ThingSpec = Omit<ThingData, 'image' | 'background_image'> &
  Pick<ThingRecord, 'id' | 'slug' | 'contents' | 'primaryFolder'> & {
    image: string | null;
    background_image: string | null;
    href: string | null;
    previewUrl?: string;
  };
export function sceneThings(rows: readonly ThingRecord[]): ThingSpec[] {
  return rows.map(t => ({
    ...t.data, id: t.id, slug: t.slug, kind: t.data.kind, contents: t.contents, primaryFolder: t.primaryFolder,
    emoji: t.data.emoji, image: t.data.icon_type === 'image' ? mediaUrl(t.data.image) : null,
    background_image: mediaUrl(t.data.background_image),
    href: (() => { try { return pathFor(t, rows); } catch { return null; } })(), body: t.data.body,
  }));
}
