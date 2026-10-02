/** Usage after backing up: bun tools/migrate-things-live.ts LOCAL_DATABASE.db */
import {localDatabase} from './local-database';
import {migrateThingsLive} from './things-live-migration';
const target=process.argv[2];
if(!target || target.startsWith('--'))throw new Error('Provide a backed-up local database. Use migrate-things-preview.ts for the remote preview.');
const db=localDatabase(target);try{console.log(await migrateThingsLive(db));}finally{await db.destroy();}
