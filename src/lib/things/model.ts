/** Shared authoring/rendering contract. CMS references stay separate from field data. */
export const STUDIO_PATH = '/_emdash/admin/plugins/liftaris-things/workspace';
export const PAGE_SOURCES = { content: null, post: null, projects: '/projects', experience: '/experience', github: '/github', guestbook: '/guestbook' } as const;
type ThingKind = 'page' | 'folder';
export type ThingData = {
  name: string; kind: ThingKind; icon_type: 'emoji' | 'image'; emoji: string; image: unknown;
  width: number; height: number; window_width: number; window_height: number;
  window_x?: number | null; window_y?: number | null;
  desktop: boolean; default_open: boolean; sort_order: number; spawn_x: number; spawn_y: number;
  page_source: keyof typeof PAGE_SOURCES; body: unknown[];
  path_override: string; background_image: unknown;
  background_size: string; background_position: string; background_repeat: string;
};
export interface ThingRecord {
  id: string; slug: string; status: string; data: ThingData;
  contents: string[]; primaryFolder: string | null; postId?: string | null;
}
export const DEFAULT_DATA: ThingData = {
  name: 'New Thing', kind: 'folder', icon_type: 'emoji', emoji: '📦', image: null,
  width: 60, height: 60, window_width: 480, window_height: 380,
  window_x: null, window_y: null,
  desktop: true,
  default_open: false, sort_order: 0, spawn_x: .5, spawn_y: .5,
  page_source: 'content', body: [], path_override: '',
  background_image: null, background_size: 'cover', background_position: 'center', background_repeat: 'no-repeat',
};
export function slugFromName(name: string): string {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'thing';
}
export function mediaUrl(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.startsWith('/') || /^https?:\/\//.test(value) ? value : '/_emdash/api/media/file/' + value;
  }
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const meta = v.meta as Record<string, unknown> | undefined;
  const raw = typeof v.src === 'string' ? v.src : typeof v.url === 'string' ? v.url : typeof meta?.storageKey === 'string' ? meta.storageKey : null;
  if (!raw) return null;
  return raw.startsWith('/') || /^https?:\/\//.test(raw) ? raw : '/_emdash/api/media/file/' + raw;
}

function normalizeMediaValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.startsWith('/') || /^https?:\/\//.test(value) ? value : `/_emdash/api/media/file/${value}`;
  }
  if (!value || typeof value !== 'object') return value;
  const v = value as Record<string, unknown>;
  const src = typeof v.src === 'string' ? v.src : undefined;
  if (src && !src.startsWith('/') && !/^https?:\/\//.test(src)) {
    return { ...v, src: `/_emdash/api/media/file/${src}` };
  }
  return value;
}

export function normalizeData(data: Record<string, unknown>): ThingData {
  const normalized = { ...DEFAULT_DATA, ...data } as ThingData;
  if (normalized.image) normalized.image = normalizeMediaValue(normalized.image);
  if (normalized.background_image) normalized.background_image = normalizeMediaValue(normalized.background_image);
  return normalized;
}
export function pathFor(thing: ThingRecord, all: readonly ThingRecord[], seen = new Set<string>()): string | null {
  if (seen.has(thing.id)) throw new Error('Primary folders cannot form a cycle.');
  seen.add(thing.id);
  const builtin = thing.data.kind === 'page' ? PAGE_SOURCES[thing.data.page_source] : null;
  if (builtin) return builtin;
  if (thing.data.path_override) return validPath(thing.data.path_override);
  const segment = thing.slug;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(segment)) throw new Error(`Choose a lowercase URL slug for ${thing.data.name}.`);
  if (!thing.primaryFolder) return '/' + segment;
  const parent = all.find(t => t.id === thing.primaryFolder);
  if (!parent || parent.data.kind !== 'folder') throw new Error(`${thing.data.name} needs an available primary folder.`);
  return `${pathFor(parent, all, seen)}/${segment}`;
}
function validPath(path: string): string {
  if (!/^\/(?:[a-z0-9][a-z0-9_-]*)(?:\/[a-z0-9][a-z0-9_-]*)*$/.test(path)) throw new Error('Use a site path such as /writing/my-post, with lowercase URL segments.');
  return path;
}
const RESERVED = new Set(['api', '_emdash', '_astro', '_image', 'admin', 'blog', 'things-preview', '404']);
export function validateGraph(all: readonly ThingRecord[]): void {
  const routes = new Map<string, string>();
  const visit = (thing: ThingRecord, seen: Set<string>) => {
    if (seen.has(thing.id)) throw new Error('Folders cannot contain themselves or an ancestor.');
    const next = new Set(seen).add(thing.id);
    for (const id of thing.contents) {
      const child = all.find(t => t.id === id);
      if (child?.data.kind === 'folder') visit(child, next);
    }
  };
  for (const thing of all) {
    if (!['page','folder'].includes(thing.data.kind)) throw new Error(`Choose a valid kind for ${thing.data.name}.`);
    if (!thing.data.name?.trim()) throw new Error('Every Thing needs a name.');
    // Validate ancestry independently of URL generation: overrides and built-in
    // routes must not hide a cycle or an unavailable parent.
    const ancestors = new Set([thing.id]);
    let parentId = thing.primaryFolder;
    while (parentId) {
      if (ancestors.has(parentId)) throw new Error('Primary folders cannot form a cycle.');
      ancestors.add(parentId);
      const parent = all.find(t => t.id === parentId);
      if (!parent || parent.data.kind !== 'folder') throw new Error(`${thing.data.name} needs a published primary folder.`);
      parentId = parent.primaryFolder;
    }
    if (thing.data.kind === 'folder') visit(thing, new Set());
    const path = pathFor(thing, all);
    if (!path) continue;
    const builtin = thing.data.kind === 'page' && PAGE_SOURCES[thing.data.page_source] === path;
    if ((!builtin && RESERVED.has(path.split('/')[1])) || (!builtin && Object.values(PAGE_SOURCES).includes(path as '/projects'))) throw new Error(`${path} is reserved by the site.`);
    if (routes.has(path)) throw new Error(`${path} is already used by another Thing.`);
    routes.set(path, thing.id);
  }
}
export function dependentNames(id: string, all: readonly ThingRecord[]): string[] {
  return all.filter(t => t.primaryFolder === id).map(t => t.data.name);
}
export function canAddToFolder(folderId: string, candidateId: string, all: readonly ThingRecord[]): boolean {
  const visited = new Set<string>();
  const reachesFolder = (id: string): boolean => {
    if (id === folderId) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    const candidate = all.find(t => t.id === id);
    return candidate?.data.kind === 'folder' && candidate.contents.some(reachesFolder);
  };
  return !reachesFolder(candidateId);
}
export function spawnPoint(data: Pick<ThingData, 'spawn_x' | 'spawn_y' | 'width' | 'height'>, size: {width: number; height: number}) {
  return { x: data.width / 2 + 5 + data.spawn_x * Math.max(0, size.width - data.width - 10),
    y: data.height / 2 + 5 + data.spawn_y * Math.max(0, size.height - data.height - 32) };
}
export function normalizedPoint(point: {x: number; y: number}, data: {width: number; height: number}, size: {width: number; height: number}) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  return { spawn_x: clamp((point.x - data.width / 2 - 5) / Math.max(1, size.width - data.width - 10)),
    spawn_y: clamp((point.y - data.height / 2 - 5) / Math.max(1, size.height - data.height - 32)) };
}
export function windowPoint(data: { window_x?: number | null; window_y?: number | null; window_width?: number; window_height?: number }, viewport: { width: number; height: number }) {
  const w = data.window_width ?? 480;
  const h = data.window_height ?? 380;
  const availX = Math.max(0, viewport.width - w - 24);
  const availY = Math.max(0, viewport.height - h - 30);
  const x = typeof data.window_x === 'number' && Number.isFinite(data.window_x)
    ? Math.round(12 + Math.max(0, Math.min(1, data.window_x)) * availX)
    : null;
  const y = typeof data.window_y === 'number' && Number.isFinite(data.window_y)
    ? Math.round(18 + Math.max(0, Math.min(1, data.window_y)) * availY)
    : null;
  return { x, y };
}
export function normalizedWindowPoint(pixelPos: { x: number; y: number }, windowSize: { width: number; height: number }, viewport: { width: number; height: number }) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const availX = Math.max(1, viewport.width - windowSize.width - 24);
  const availY = Math.max(1, viewport.height - windowSize.height - 30);
  return {
    window_x: Math.round(clamp((pixelPos.x - 12) / availX) * 1000) / 1000,
    window_y: Math.round(clamp((pixelPos.y - 18) / availY) * 1000) / 1000,
  };
}
