/** Offline migration. Only writes a disposable output copy; source is never opened writable. */
import { copyFileSync, existsSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { localDatabase } from './local-database';
import { migrateThingsLive } from './things-live-migration';
import { applySeed, ContentRepository, RevisionRepository, OptionsRepository, handleContentUpdate, handleContentPublish, SchemaRegistry, handleContentGet } from 'emdash';
import { SeoRepository } from '../node_modules/emdash/src/database/repositories/seo';
import { BylineRepository } from '../node_modules/emdash/src/database/repositories/byline';
import { thingsCollection, thingFields } from '../src/lib/things/schema';
import { convertThing, convertPost, slugFromName } from './things-convert';
import { policyGraph } from '../src/server/things/graph';
import { validateGraph, DEFAULT_DATA } from '../src/lib/things/model';
const [source, output, flag] = process.argv.slice(2);
if (!source || !output || resolve(source) === resolve(output)) throw new Error('Usage: bun tools/migrate-things.ts SOURCE.db OUTPUT.db [--apply]. Source and output must differ.');
if(existsSync(output)) throw new Error('Output already exists. Keep the validated copy or choose a new output.');
const temporary=output+'.pending'; if(existsSync(temporary)) rmSync(temporary);
copyFileSync(source,temporary);
const db=localDatabase(temporary);
const repo=new ContentRepository(db), revisions=new RevisionRepository(db), options=new OptionsRepository(db);
const readAll=async(type:string)=>{const entries=[];let cursor:string|undefined;do{const page=await repo.findMany(type,{limit:100,cursor});entries.push(...page.items);cursor=page.nextCursor;}while(cursor);return entries;};
function unwrap(result: Awaited<ReturnType<typeof handleContentGet>>) {if(!result.success) throw new Error(JSON.stringify(result.error));return result.data.item;}
try {
 const oldThings=await readAll('things'), posts=await readAll('posts');
 const report={version:1,things:oldThings.length,posts:posts.length,mappings:posts.map(p=>({collection:'posts',source:p.id,target:p.id,slug:slugFromName(p.slug || p.data.title as string)})),brokenParents:oldThings.filter(t=>t.data.parent_id&&!oldThings.some(p=>p.id===t.data.parent_id)).map(t=>t.id),pendingDrafts:[...oldThings,...posts].filter(t=>t.draftRevisionId).map(t=>t.id)};
 if(report.brokenParents.length) throw new Error('Broken parent references: '+report.brokenParents.join(', '));
 writeFileSync(output+'.report.json',JSON.stringify(report,null,2));
 if(flag!=='--apply') {console.log(JSON.stringify(report,null,2));await db.destroy();rmSync(temporary);process.exit(0);}
 if(await options.get('liftaris.things.migration.v1')) {await migrateThingsLive(db);await db.destroy();renameSync(temporary,output);console.log('Already migrated; copied unchanged.');process.exit(0);}
 await applySeed(db,{version:'1',collections:[{...thingsCollection,supports:['drafts','revisions','preview','search','seo'],fields:thingFields.map(f=>({...f,validation:f.validation ? {...f.validation} : undefined}))}] },{onConflict:'update'});
 await new SchemaRegistry(db).updateCollection('posts',{hidden:true,label:'Posts archive'});
 const snapshotDrafts=new Map<string,Record<string,unknown>>();
 for(const entry of [...oldThings,...posts]) if(entry.draftRevisionId) snapshotDrafts.set(entry.id,(await revisions.findById(entry.draftRevisionId))!.data);
 for(const entry of oldThings) await repo.update('things',entry.id,{data:convertThing(entry.id,{...entry.data,slug:entry.slug}),slug:entry.id==='writing-folder'?'writing':slugFromName(entry.slug || String(entry.data.name))});
 const writing=oldThings.find(t=>t.id==='writing-folder');
 if(posts.length&&!writing) throw new Error('Posts require a Writing folder; resolve the inventory before migrating.');
 for(const post of posts) {
  const data=convertPost(post.data,post.slug!);
  await repo.create({id:post.id,type:'things',slug:slugFromName(post.slug!),data,status:post.status,authorId:post.authorId ?? undefined,primaryBylineId:post.primaryBylineId,createdAt:post.createdAt,publishedAt:post.publishedAt,locale:post.locale ?? undefined});
 }
 if(oldThings.length&&!oldThings.some(t=>t.id==='github')) await repo.create({id:'github',type:'things',slug:'github',status:'published',data:{...DEFAULT_DATA,name:'GitHub',kind:'page',page_source:'github',icon_type:'image',image:{src:'/github.svg',alt:'GitHub'},width:58,height:58,sort_order:14,spawn_x:.8,spawn_y:.4}});
 const all=await readAll('things');
 for(const entry of all) {
  const old=oldThings.find(t=>t.id===entry.id);const post=posts.find(t=>t.id===entry.id);
  const contents=oldThings.filter(t=>t.data.parent_id===entry.id).sort((a,b)=>Number(a.data.sort_order)-Number(b.data.sort_order)).map(t=>t.id);
  if(entry.id===writing?.id) contents.push(...posts.map(p=>p.id));
  const primary=post ? writing?.id : old?.data.parent_id as string|undefined;
  const extras: {seo?: Awaited<ReturnType<SeoRepository['get']>>;bylines?: {bylineId:string;roleLabel?:string|null}[]}={};
  if(post){extras.seo=await new SeoRepository(db).get('posts',post.id);const credits=await new BylineRepository(db).getContentBylines('posts',post.id);extras.bylines=credits.map(c=>({bylineId:c.byline.id,roleLabel:c.roleLabel}));}
  unwrap(await handleContentUpdate(db,'things',entry.id,{data:entry.data,references:{contents,primary_folder:primary?[primary]:[]},...extras}));
  const revision=await revisions.create({collection:'things',entryId:entry.id,data:{...entry.data,_slug:entry.slug,_references:{contents,primary_folder:primary?[primary]:[]}}});
  await repo.setDraftRevision('things',entry.id,revision.id);
  if(entry.status==='published') unwrap(await handleContentPublish(db,'things',entry.id,{publishedAt:entry.publishedAt ?? undefined}));
  const draft=snapshotDrafts.get(entry.id);
  if(draft) { const revision=await revisions.create({collection:'things',entryId:entry.id,data:{...draft,...(post?convertPost(draft,post.slug!):convertThing(entry.id,draft)),_slug:typeof draft._slug==='string'?slugFromName(draft._slug):entry.slug,_references:{contents,primary_folder:primary?[primary]:[]}}});await repo.setDraftRevision('things',entry.id,revision.id); }
 }
 validateGraph(await policyGraph(db));
 await options.set('liftaris.things.migration.v1',JSON.stringify(report));
 await migrateThingsLive(db);
 Object.assign(report,{verifiedThings:(await readAll('things')).length,published:(await policyGraph(db)).length});
 writeFileSync(output+'.report.json',JSON.stringify(report,null,2));
 await db.destroy();renameSync(temporary,output);console.log(JSON.stringify(report,null,2));
} catch(error) {await db.destroy();throw error;}
