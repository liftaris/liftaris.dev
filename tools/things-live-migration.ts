/** Incremental v2 migration: preserve Posts, make Thing saves live, retain old revisions. */
import { ContentRepository, RevisionRepository, OptionsRepository, SchemaRegistry, applySeed, handleContentUpdate, handleContentPublish, type Database } from 'emdash';
import type {Kysely} from 'kysely';
import {thingsCollection,thingFields} from '../src/lib/things/schema';
import {policyGraph} from '../src/server/things/graph';
import {validateGraph} from '../src/lib/things/model';
const check=<T>(result:{success:true;data:T}|{success:false;error:{message:string}}):T=>{if(!result.success)throw new Error(result.error.message);return result.data;};
export async function migrateThingsLive(db:Kysely<Database>) {
 const options=new OptionsRepository(db),repo=new ContentRepository(db),revisions=new RevisionRepository(db),schema=new SchemaRegistry(db);
 if(await options.get('liftaris.things.migration.v2'))return {alreadyApplied:true};
 const readAll=async(type:string)=>{const entries=[];let cursor:string|undefined;do{const page=await repo.findMany(type,{limit:100,cursor});entries.push(...page.items);cursor=page.nextCursor;}while(cursor);return entries;};
 const things=await readAll('things'),posts=await readAll('posts');
 // Preserve a recoverable snapshot before altering any entry or schema feature.
 if(!await options.get('liftaris.things.migration.v2.before'))await options.set('liftaris.things.migration.v2.before',{things,posts});
 const collection=await schema.getCollectionWithFields('things');
 if(!collection)throw new Error('Things schema is missing. Run the initial migration first.');
 await applySeed(db,{version:'1',collections:[{...thingsCollection,supports:collection.supports,fields:thingFields.map(f=>({...f,validation:f.validation?{...f.validation}:undefined}))}]},{onConflict:'update'});
 let linked=0, promoted=0;
 for(const entry of things) {
  const marker=`liftaris.things.migration.v2.entry:${entry.id}`;
  if(await options.get(marker))continue;
  const post=posts.find(p=>p.id===entry.id || (entry.data.legacy_paths as string[]|undefined)?.includes('/blog/'+p.slug));
  const pending=entry.draftRevisionId ? await revisions.findById(entry.draftRevisionId) : null;
  if(post && entry.data.page_source!=='post') {
   // Only propagate newer edits from the formerly unified editor. The native
   // Post's own draft is kept separately and is never published by this migration.
   const postDraft=post.draftRevisionId;
   if(entry.updatedAt>=post.updatedAt && JSON.stringify(entry.data.body)!==JSON.stringify(post.data.content)) {
    const revision=await revisions.create({collection:'posts',entryId:post.id,data:{...post.data,content:entry.data.body ?? [],title:entry.data.name,date:entry.data.date ?? post.data.date}});
    await repo.setDraftRevision('posts',post.id,revision.id);
    if(post.status==='published')check(await handleContentPublish(db,'posts',post.id));
    if(postDraft)await repo.setDraftRevision('posts',post.id,postDraft);
   }
   const articleDraftChanged=pending && ['body','date','name'].some(key=>JSON.stringify(pending.data[key] ?? entry.data[key])!==JSON.stringify(entry.data[key]));
   if(pending && articleDraftChanged) {
    const data={...post.data,content:pending.data.body ?? post.data.content,title:pending.data.name ?? post.data.title,date:pending.data.date ?? post.data.date};
    const existingDraft=postDraft ? await revisions.findById(postDraft) : null;
    if(existingDraft && ['content','title','date'].some(key=>JSON.stringify(existingDraft.data[key])!==JSON.stringify(data[key as keyof typeof data])))throw new Error(`Both Post and Thing have different article drafts for ${post.data.title}. Reconcile them before retrying; neither draft was removed.`);
    if(!existingDraft){const revision=await revisions.create({collection:'posts',entryId:post.id,data});await repo.setDraftRevision('posts',post.id,revision.id);}
   }
  }
  // Existing Thing drafts become live properties; linked Post body drafts stay
  // in Posts. Let EmDash promote staged slug/references before disabling revisions.
  if(pending || entry.status!=='published'){check(await handleContentPublish(db,'things',entry.id));promoted++;}
  if(post) {
   check(await handleContentUpdate(db,'things',entry.id,{data:{page_source:'post',body:[],date:null},references:{post:[post.id]}}));
   // Update the live snapshot too while v1 revision support is still enabled.
   const current=await repo.findById('things',entry.id);
   if(collection.supports?.includes('revisions')){
    const revision=await revisions.create({collection:'things',entryId:entry.id,data:{...current!.data,page_source:'post',body:[],date:null}});
    await repo.setDraftRevision('things',entry.id,revision.id);
    check(await handleContentPublish(db,'things',entry.id));
   }
   linked++;
  }
  await options.set(marker,true);
 }
 validateGraph(await policyGraph(db));
 await schema.updateCollection('posts',{hidden:false,label:'Posts'});
 await schema.updateCollection('things',{supports:thingsCollection.supports});
 const report={things:things.length,posts:posts.length,linked,promoted};
 await options.set('liftaris.things.migration.v2',report);
 return report;
}
