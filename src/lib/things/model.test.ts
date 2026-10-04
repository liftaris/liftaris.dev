import {expect,test} from 'bun:test';
import {DEFAULT_DATA,pathFor,validateGraph,spawnPoint,normalizedPoint,slugFromName,canAddToFolder,type ThingRecord} from './model';
const thing=(id:string,patch:Partial<ThingRecord>={}):ThingRecord=>({id,slug:id,status:'published',data:{...DEFAULT_DATA,name:id},contents:[],primaryFolder:null,...patch});
test('reusable appearances do not alter primary ancestry',()=>{const parent=thing('writing',{contents:['article']});const article=thing('article',{primaryFolder:'writing',data:{...DEFAULT_DATA,kind:'page'}});const shortcut=thing('featured',{contents:['article']});expect(pathFor(article,[parent,article,shortcut])).toBe('/writing/article');});
test('cycles, duplicate paths, reserved paths and unavailable primary folders block publication',()=>{
 for(const graph of [[thing('a',{contents:['a']})],[thing('a',{contents:['b']}),thing('b',{contents:['a']})],[thing('a',{slug:'same'}),thing('b',{slug:'same'})],[thing('api')],[thing('a',{primaryFolder:'missing'})],[thing('a',{primaryFolder:'b'}),thing('b',{primaryFolder:'a'})]])expect(()=>validateGraph(graph)).toThrow();
});
test('coordinate conversions round-trip and account for icon size',()=>{for(const size of [{width:320,height:420},{width:1200,height:900}])for(const x of [0,.3,1]){const d={...DEFAULT_DATA,spawn_x:x,spawn_y:.7,width:80,height:72};const point=spawnPoint(d,size);const normalized=normalizedPoint(point,d,size);expect(normalized.spawn_x).toBeCloseTo(x);expect(normalized.spawn_y).toBeCloseTo(.7);}});
test('empty portfolio and code-managed routes are valid',()=>{validateGraph([]);validateGraph([thing('computer',{data:{...DEFAULT_DATA,kind:'page',page_source:'projects'}})]);});
test('new slugs normalize names predictably',()=>expect(slugFromName('Café & Projects!')).toBe('cafe-projects'));
test('absolute paths cannot conceal a primary ancestry cycle',()=>{
 const a=thing('a',{primaryFolder:'b',data:{...DEFAULT_DATA,path_override:'/first'}});
 const b=thing('b',{primaryFolder:'a',data:{...DEFAULT_DATA,path_override:'/second'}});
 expect(()=>validateGraph([a,b])).toThrow('Primary folders cannot form a cycle.');
});
test('folder choices exclude self and ancestors but permit reusable shortcuts',()=>{
 const all=[thing('a',{contents:['b']}),thing('b',{contents:['c']}),thing('c'),thing('page',{data:{...DEFAULT_DATA,kind:'page'}})];
 expect(canAddToFolder('c','a',all)).toBe(false);
 expect(canAddToFolder('c','c',all)).toBe(false);
 expect(canAddToFolder('c','page',all)).toBe(true);
 expect(canAddToFolder('a','c',all)).toBe(true);
});
test('spawn coordinates support decimal values with 0.001 step', async () => {
 const { thingFields } = await import('./schema');
 const spawnX = thingFields.find(f => f.slug === 'spawn_x');
 const spawnY = thingFields.find(f => f.slug === 'spawn_y');
 expect(spawnX?.validation?.min).toBe(0);
 expect(spawnX?.validation?.max).toBe(1);
 expect((spawnX?.validation as { step?: number })?.step).toBe(0.001);
 expect(spawnY?.validation?.min).toBe(0);
 expect(spawnY?.validation?.max).toBe(1);
 expect((spawnY?.validation as { step?: number })?.step).toBe(0.001);
});
test('ThingPage does not render h1 for content pages', async () => {
 const content = await Bun.file(new URL('../../components/house/ThingPage.astro', import.meta.url).pathname).text();
 expect(content).toContain('{post && <h1>{title}</h1>}');
 expect(content).not.toContain('{(!embedded || post) && <h1>{title}</h1>}');
});
