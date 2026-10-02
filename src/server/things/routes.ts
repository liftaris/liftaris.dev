import { OptionsRepository, type Database } from 'emdash';
import type { Kysely } from 'kysely';
import { pathFor, type ThingRecord } from '../../lib/things/model';
const key = (path:string) => 'liftaris:things:former-path:' + path;
export function routeChanges(before: ThingRecord[], after: ThingRecord[]) {
  return before.flatMap(t => {
    const next=after.find(n=>n.id===t.id);if(!next)return [];
    const from=pathFor(t,before),to=pathFor(next,after);
    return from && to && from!==to ? [{id:t.id,name:t.data.name,from,to}] : [];
  });
}
/** Record aliases before publication; readers resolve their destination against live content.
 * Failed publication cannot redirect a live canonical path, and descendant drafts stay untouched. */
export async function rememberRoutes(db:Kysely<Database>, before:ThingRecord[], after:ThingRecord[]) {
  const options=new OptionsRepository(db);
  for(const change of routeChanges(before,after)) await options.set(key(change.from),change.id);
}
export async function formerRoute(db:Kysely<Database>, path:string, live:ThingRecord[]) {
  const id=await new OptionsRepository(db).get<string>(key(path));
  const target=live.find(t=>t.id===id);
  return target ? pathFor(target,live) : null;
}
