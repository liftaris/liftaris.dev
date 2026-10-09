import { mediaUrl, pathFor, type ThingRecord } from './model';
import type { ThingData } from './model';

export type ThingSpec = Omit<ThingData, 'image' | 'background_image' | 'body'> &
  Pick<ThingRecord, 'id' | 'slug' | 'contents' | 'primaryFolder'> & {
    image: string | null;
    background_image: string | null;
    href: string | null;
    previewUrl?: string;
  };
export function sceneThings(rows: readonly ThingRecord[]): ThingSpec[] {
  return rows.map(t => ({
    name: t.data.name, icon_type: t.data.icon_type,
    width: t.data.width, height: t.data.height,
    window_width: t.data.window_width, window_height: t.data.window_height,
    window_x: t.data.window_x, window_y: t.data.window_y,
    desktop: t.data.desktop, default_open: t.data.default_open, sort_order: t.data.sort_order,
    spawn_x: t.data.spawn_x, spawn_y: t.data.spawn_y,
    page_source: t.data.page_source, path_override: t.data.path_override,
    background_size: t.data.background_size, background_position: t.data.background_position,
    background_repeat: t.data.background_repeat,
    id: t.id, slug: t.slug, kind: t.data.kind, contents: t.contents, primaryFolder: t.primaryFolder,
    emoji: t.data.emoji, image: t.data.icon_type === 'image' ? mediaUrl(t.data.image) : null,
    background_image: mediaUrl(t.data.background_image),
    href: (() => { try { return pathFor(t, rows); } catch { return null; } })(),
  }));
}
