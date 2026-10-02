"""Import only into this task's dedicated preview DB. Parameterized D1 API batches avoid SQL dump parser limits."""
import sqlite3,json,tomllib,urllib.request,time,sys
from pathlib import Path
ACCOUNT='8df695f5ca97195e8c6f4896b81be028';TARGET='6bf414ef-c86a-4674-b7ab-e0dac70f7bf6'
token=tomllib.loads((Path.home()/'.config/.wrangler/config/default.toml').read_text())['oauth_token']
def execute(queries):
 req=urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{TARGET}/query',data=json.dumps({'batch':[{'params':[],**queries,'sql':queries['sql'].rstrip(';')+';'}]}).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=60) as response:body=json.load(response)
 except urllib.error.HTTPError as e:raise RuntimeError(e.read().decode()[:500]) from None
 if not body.get('success'):raise RuntimeError(str(body.get('errors')))
 return body
source=sqlite3.connect(sys.argv[1]);source.row_factory=sqlite3.Row
schema=source.execute("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name").fetchall()
virtual=[r['name'] for r in schema if 'VIRTUAL TABLE' in r['sql'].upper()]
shadows={name+suffix for name in virtual for suffix in ['_data','_idx','_content','_docsize','_config']}
tables=[r for r in schema if r['type']=='table' and r['name'] not in shadows]
pending={r['name'] for r in tables};ordered=[]
while pending:
 ready=[name for name in pending if not {r[2] for r in source.execute(f'PRAGMA foreign_key_list("{name}")')}.difference({name}).intersection(pending)]
 if not ready:raise RuntimeError('Cyclic schema dependencies: '+str(pending))
 ordered+=ready;pending.difference_update(ready)
if '--reset' in sys.argv:
 for name in reversed(ordered):execute({'sql':f'DROP TABLE IF EXISTS \"{name}\"'})
for r in ([] if '--triggers-only' in sys.argv else tables):
 sql=r['sql'].replace('CREATE TABLE ','CREATE TABLE IF NOT EXISTS ',1).replace('CREATE VIRTUAL TABLE ','CREATE VIRTUAL TABLE IF NOT EXISTS ',1)
 execute({'sql':sql})
print('Schema ready',flush=True)
for name in ([] if '--triggers-only' in sys.argv else ordered):
 rows=source.execute(f'SELECT * FROM "{name}"').fetchall()
 queries=[]
 for row in rows:
  columns=row.keys();values=[list(v) if isinstance(v,bytes) else v for v in row]
  queries.append({'sql':f'INSERT OR IGNORE INTO "{name}" ('+','.join('"'+c+'"' for c in columns)+') VALUES ('+','.join('?' for c in columns)+')','params':values})
 for query in queries:execute(query)
 if rows:print(name,len(rows),flush=True)
for r in schema:
 if r['type'] in ['trigger','index'] and r['tbl_name'] not in shadows:
  sql=r['sql'].replace('CREATE INDEX ','CREATE INDEX IF NOT EXISTS ',1).replace('CREATE UNIQUE INDEX ','CREATE UNIQUE INDEX IF NOT EXISTS ',1).replace('CREATE TRIGGER ','CREATE TRIGGER IF NOT EXISTS ',1)
  print('Restoring',r['name'],flush=True);execute({'sql':sql})
print('Verified counts',execute({'sql':'SELECT (SELECT count(*) FROM ec_things) things, (SELECT count(*) FROM ec_posts) posts, (SELECT count(*) FROM media) media'})['result'][0]['results'])
