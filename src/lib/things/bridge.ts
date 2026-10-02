import type { ThingRecord } from './model';
export type PreviewMessage =
  | { type: 'snapshot'; things: ThingRecord[]; selected: string | null; previewUrl?: string }
  | { type: 'ready' }
  | { type: 'select' | 'trash'; id: string }
  | { type: 'position'; id: string; spawn_x: number; spawn_y: number }
  | { type: 'resize'; id: string; window_width: number; window_height: number };
export function messageFor(session: string, message: PreviewMessage) { return { channel: 'liftaris-things', session, ...message }; }
export function validMessage(event: MessageEvent, source: Window | null, session: string): event is MessageEvent<PreviewMessage & {session: string}> {
  if (event.origin !== location.origin || event.source !== source || !event.data || event.data.channel !== 'liftaris-things' || event.data.session !== session) return false;
  const d = event.data;
  if (d.type === 'ready') return true;
  if (d.type === 'snapshot') return Array.isArray(d.things) && d.things.length <= 10000 && d.things.every((t: ThingRecord) => t && typeof t === 'object' && typeof t.id === 'string' && typeof t.data?.name === 'string' && Array.isArray(t.contents));
  if (typeof d.id !== 'string') return false;
  if (d.type === 'select' || d.type === 'trash') return true;
  if (d.type === 'position') return [d.spawn_x, d.spawn_y].every(v => Number.isFinite(v) && v >= 0 && v <= 1);
  if (d.type === 'resize') return Number.isFinite(d.window_width) && Number.isFinite(d.window_height) && d.window_width >= 180 && d.window_width <= 2560 && d.window_height >= 100 && d.window_height <= 1800;
  return false;
}
