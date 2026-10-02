/** Explicit second seed pass: EmDash 1.0.1 does not resolve forward/self references. */
import {readFileSync} from 'node:fs';
import {ContentRepository,handleContentUpdate,handleContentPublish,type Database} from 'emdash';
import type {Kysely} from 'kysely';
import {localDatabase} from './local-database';
export async function finalizeThingsSeed(db:Kysely<Database>) {
 const placements=JSON.parse(readFileSync(new URL('../seed/things-placements.json',import.meta.url),'utf8')) as {slug:string;contents:string[];primary:string|null}[];
 const repo=new ContentRepository(db);const entries=new Map<string,Awaited<ReturnType<typeof repo.findBySlug>>>();
 for(const p of placements)entries.set(p.slug,await repo.findBySlug('things',p.slug));
 for(const p of placements){
  const entry=entries.get(p.slug);if(!entry)throw new Error('Seed entry missing: '+p.slug);
  if(entry.draftRevisionId)throw new Error('Seed initialization refuses to overwrite a pending draft: '+p.slug);
  const ids=p.contents.map(slug=>{const e=entries.get(slug);if(!e)throw new Error('Seed target missing: '+slug);return e.id;});
  const primary=p.primary ? entries.get(p.primary)?.id : null;if(p.primary&&!primary)throw new Error('Seed parent missing: '+p.primary);
  const saved=await handleContentUpdate(db,'things',entry.id,{data:{},references:{contents:ids,primary_folder:primary?[primary]:[]}});
  if(!saved.success)throw new Error(saved.error.message);
  if(entry.status==='published'){const published=await handleContentPublish(db,'things',entry.id);if(!published.success)throw new Error(published.error.message);}
 }
}
if(import.meta.main){if(!process.argv[2])throw new Error('Pass a local fresh-install SQLite path.');const db=localDatabase(process.argv[2]);try{await finalizeThingsSeed(db);console.log('Seed placements initialized.');}finally{await db.destroy();}}
