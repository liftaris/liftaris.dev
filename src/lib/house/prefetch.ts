import { PAGE_SOURCES } from '../things/model';
type Target = {id?:string;href?:string|null;kind?:string;page_source?:keyof typeof PAGE_SOURCES;previewUrl?:string;items?:readonly unknown[]};
let prefetchFn:((url:string)=>void)|undefined;
export function getThingPrefetchUrls(thing?:Target|null):string[] {
  if(!thing || thing.previewUrl)return [];
  const url=thing.href || (thing.page_source ? PAGE_SOURCES[thing.page_source] : null);
  if(!url?.startsWith('/') || url.startsWith('//'))return [];
  return thing.kind==='page' ? [url,`${url}${url.includes('?')?'&':'?'}window=1`] : [url];
}
export function prefetchUrl(url?:string|null) {
  if(!url || typeof window==='undefined')return;
  if(prefetchFn){prefetchFn(url);return;}
  void import('astro:prefetch').then(mod=>{prefetchFn=mod.prefetch;prefetchFn(url);}).catch(()=>{});
}
export function prefetchThing(thing?:Target|null) {
  if(!thing)return;
  for(const entry of thing.items ?? [])if(entry && typeof entry==='object')prefetchThing(('value' in entry?entry.value:entry) as Target);
  for(const url of getThingPrefetchUrls(thing))prefetchUrl(url);
}
