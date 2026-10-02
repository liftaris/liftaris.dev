"""Read-only preview snapshot, including FTS schemas. Never accepts the production DB."""
import json, os, sqlite3, sys, tomllib, urllib.request
from pathlib import Path
PREVIEW = '6bf414ef-c86a-4674-b7ab-e0dac70f7bf6' if '--things' in sys.argv else 'a5e64636-afe8-44f9-87e6-5055554edda9'
ACCOUNT = '8df695f5ca97195e8c6f4896b81be028'
config = tomllib.loads((Path.home()/'.config/.wrangler/config/default.toml').read_text())
token = os.environ.get('CLOUDFLARE_API_TOKEN') or config['oauth_token']
def query(sql):
 req=urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{PREVIEW}/query',data=json.dumps({'sql':sql}).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=60) as response: body=json.load(response)
 if not body.get('success'): raise RuntimeError('Preview snapshot query failed')
 return body['result'][0]['results']
path=Path(sys.argv[1]);path.parent.mkdir(parents=True,exist_ok=True)
if path.exists(): raise RuntimeError('Refusing to overwrite a snapshot')
db=sqlite3.connect(path)
schema=query("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name")
virtual=[r['name'] for r in schema if 'VIRTUAL TABLE' in r['sql'].upper()]
# FTS tables are rebuilt from the CMS content; do not replay shadow storage.
shadows={name+suffix for name in virtual for suffix in ['_data','_idx','_content','_docsize','_config']}
for r in schema:
 if r['type']=='table' and r['name'] not in shadows: db.execute(r['sql'])
counts={}
for r in schema:
 if r['type']!='table' or r['name'] in shadows or r['name'] in virtual: continue
 name=r['name'];rows=query('SELECT * FROM "'+name.replace('"','""')+'"');counts[name]=len(rows)
 if rows:
  columns=list(rows[0]);stmt='INSERT INTO "'+name+'" ('+','.join('"'+c+'"' for c in columns)+') VALUES ('+','.join('?' for _ in columns)+')'
  db.executemany(stmt,[tuple(bytes(row[c]) if isinstance(row[c],list) else json.dumps(row[c]) if isinstance(row[c],dict) else row[c] for c in columns) for row in rows])
for r in schema:
 if r['type'] in ['index','trigger'] and r['tbl_name'] not in shadows: db.execute(r['sql'])
for name in virtual:
 try: db.execute(f'INSERT INTO "{name}" ("{name}") VALUES (\'rebuild\')')
 except sqlite3.OperationalError: pass
db.commit();db.close();os.chmod(path,0o600)
print(json.dumps({'snapshot':str(path),'counts':{k:v for k,v in counts.items() if k in ['ec_things','ec_posts','media','revisions','_emdash_content_references']}}))
