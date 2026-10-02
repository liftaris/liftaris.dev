import { DEFAULT_DATA, PAGE_SOURCES, slugFromName, normalizedPoint, normalizeData } from '../src/lib/things/model';
import { initialPoses } from '../src/components/clump/model';
export function convertThing(id: string, source: Record<string, unknown>) {
  const data = normalizeData(Object.fromEntries(Object.entries(source).filter(([k]) => k in DEFAULT_DATA || k === 'date')));
  data.kind = source.kind === 'page' || source.action === 'projects' || source.action === 'experience' || source.kind === 'link' ? 'page' : source.action === 'leave-gift' ? 'application' : 'folder';
  data.page_source = source.action === 'projects' || source.action === 'experience' ? source.action : source.href === '/lab/clump' ? 'clump' : typeof source.page_source==='string' && source.page_source in PAGE_SOURCES ? source.page_source as keyof typeof PAGE_SOURCES : 'content';
  data.icon_type = source.image ? 'image' : 'emoji';
  data.window_width = Number(source.window_width ?? (data.kind === 'page' ? 700 : 420));
  data.window_height = Number(source.window_height ?? (data.kind === 'page' ? 560 : 340));
  const pose = initialPoses('clump', {width:600,height:600}).find(p => p.id === id);
  Object.assign(data, pose ? normalizedPoint(pose,data,{width:600,height:600}) : {spawn_x: .2 + ((Number(source.sort_order) || 0) % 4) * .2,spawn_y: .7});
  if(source.spawn_x != null) data.spawn_x = Number(source.spawn_x);
  if(source.spawn_y != null) data.spawn_y = Number(source.spawn_y);
  data.legacy_paths = Array.isArray(source.legacy_paths) ? source.legacy_paths : source.kind === 'page' ? [`/${source.slug || id}`,`/p/${source.slug || id}`] : [];
  return data;
}
export function convertPost(source: Record<string, unknown>, slug: string) {
  return {...DEFAULT_DATA,kind:'page' as const,name:String(source.title || 'Untitled'),emoji:String(source.icon || '📄'),body:Array.isArray(source.content)?source.content:[],date:typeof source.date==='string'?source.date:null,desktop:false,
    window_width:700,window_height:560,legacy_paths:[`/blog/${slug}`,`/p/${slug}`]};
}
export { slugFromName };
