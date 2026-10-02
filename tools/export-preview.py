"""Dump a rehearsed SQLite database for import into an EMPTY preview D1 database."""
import sqlite3,sys
from pathlib import Path
source,output=map(Path,sys.argv[1:]);db=sqlite3.connect(source)
rows=db.execute("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name").fetchall()
virtual=[r[1] for r in rows if 'VIRTUAL TABLE' in r[3].upper()]
shadows={name+suffix for name in virtual for suffix in ['_data','_idx','_content','_docsize','_config']}
def quote(v):
 if v is None:return 'NULL'
 if isinstance(v,bytes):return "X'"+v.hex()+"'"
 if isinstance(v,(int,float)):return str(v)
 return "'"+v.replace("'","''")+"'"
with output.open('w') as out:
 out.write('PRAGMA defer_foreign_keys=ON;\n')
 for kind,name,table,sql in rows:
  if kind=='table' and name not in shadows:out.write(sql+';\n')
 for kind,name,table,sql in rows:
  if kind!='table' or name in shadows:continue
  columns=[r[1] for r in db.execute(f'PRAGMA table_info("{name}")')]
  for row in db.execute(f'SELECT * FROM "{name}"'):
   out.write('INSERT INTO "'+name+'" ('+','.join('"'+c+'"' for c in columns)+') VALUES ('+','.join(map(quote,row))+');\n')
 for kind,name,table,sql in rows:
  if kind in ['index','trigger'] and table not in shadows:out.write(sql+';\n')
 out.write('PRAGMA defer_foreign_keys=OFF;\n')
output.chmod(0o600);print('Created private D1 import:',output)
