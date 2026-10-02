/** Bundle for Node before running; Wrangler remote bindings require Node. */
import {readFileSync} from 'node:fs';
import {Kysely} from 'kysely';
import type {Database} from 'emdash';
import {migrateThingsLive} from './things-live-migration';
const configPath=process.argv[2];
if(!configPath)throw new Error('Provide the dedicated preview Wrangler config.');
 const config=JSON.parse(readFileSync(configPath,'utf8'));
 if(config.d1_databases?.length!==1||config.d1_databases[0].database_id!=='6bf414ef-c86a-4674-b7ab-e0dac70f7bf6'||config.d1_databases[0].binding!=='DB'||config.d1_databases[0].remote!==true)throw new Error('Only the isolated Things preview database is allowed.');
 const {getPlatformProxy}=await import('wrangler');
 const {RawBindingD1Dialect}=await import('../node_modules/@emdash-cms/cloudflare/src/db/d1-dialect');
 const proxy=await getPlatformProxy<{DB:D1Database}>({configPath,remoteBindings:true});
 const db=new Kysely<Database>({dialect:new RawBindingD1Dialect({database:proxy.env.DB})});
 try{console.log(await migrateThingsLive(db));}finally{await db.destroy();await proxy.dispose();}
