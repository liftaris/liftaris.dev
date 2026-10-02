import {expect,test} from 'bun:test';
import {getThingPrefetchUrls} from './prefetch';
test('uses canonical routes for reusable Page Things',()=>expect(getThingPrefetchUrls({kind:'page',href:'/writing/article'})).toEqual(['/writing/article','/writing/article?window=1']));
test('registered code-managed pages share the page reader',()=>expect(getThingPrefetchUrls({kind:'page',page_source:'projects'})).toEqual(['/projects','/projects?window=1']));
test('signed draft previews never enter public prefetch caches',()=>expect(getThingPrefetchUrls({kind:'page',href:'/article',previewUrl:'/things-preview/123?token=private'})).toEqual([]));
test('does not prefetch missing or external routes',()=>{expect(getThingPrefetchUrls(null)).toEqual([]);expect(getThingPrefetchUrls({href:'//other.test'})).toEqual([]);});
