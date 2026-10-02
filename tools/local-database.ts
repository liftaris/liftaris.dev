import { Database as SQLite, type SQLQueryBindings } from 'bun:sqlite';
import { Kysely, SqliteDialect } from 'kysely';
import type { Database } from 'emdash';
/** Kysely's SQLite dialect expects the better-sqlite3 reader flag. */
export function localDatabase(path:string) {
  const raw=new SQLite(path);raw.run('PRAGMA foreign_keys=ON');
  const sqlite={close:()=>raw.close(),prepare:(sql:string)=>{const stmt=raw.prepare(sql);return {reader:stmt.columnNames.length>0,all:(params:readonly unknown[])=>stmt.all(...params as SQLQueryBindings[]),run:(params:readonly unknown[])=>stmt.run(...params as SQLQueryBindings[]),iterate:(params:readonly unknown[])=>stmt.iterate(...params as SQLQueryBindings[])};}};
  return new Kysely<Database>({dialect:new SqliteDialect({database:sqlite})});
}
