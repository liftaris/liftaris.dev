/** Usage: node tools/restore-preview-triggers.mjs PRIVATE_TRIGGER_JSON PRIVATE_WRANGLER_CONFIG */
import {getPlatformProxy} from 'wrangler';
import {readFileSync} from 'node:fs';
const [triggersPath,configPath]=process.argv.slice(2);
if(!triggersPath||!configPath)throw new Error('Provide trigger JSON and the dedicated preview binding config.');
const config=JSON.parse(readFileSync(configPath,'utf8'));
if(config.d1_databases?.length!==1||config.d1_databases[0].database_id!=='6bf414ef-c86a-4674-b7ab-e0dac70f7bf6'||config.d1_databases[0].binding!=='DB'||config.d1_databases[0].remote!==true)throw new Error('Only this task’s isolated preview DB is allowed.');
const proxy=await getPlatformProxy({configPath,remoteBindings:true});
try {
 const triggers=JSON.parse(readFileSync(triggersPath,'utf8'));
 for(const sql of triggers){if(typeof sql!=='string'||!sql.startsWith('CREATE TRIGGER '))throw new Error('Expected native trigger DDL.');await proxy.env.DB.prepare(sql.replace('CREATE TRIGGER ','CREATE TRIGGER IF NOT EXISTS ')).run();}
 console.log('Restored native triggers:',triggers.length);
 console.log('Verified preview',await proxy.env.DB.prepare('SELECT (SELECT count(*) FROM ec_things) things,(SELECT count(*) FROM ec_posts) posts,(SELECT count(*) FROM media) media').first());
}finally{await proxy.dispose();}
