import { definePlugin, ContentSaveRejectedError, PluginRouteError } from 'emdash';
import { getDb } from 'emdash/runtime';
import { policyGraph, postChoices } from '../server/things/graph';
import { rememberRoutes, routeChanges } from '../server/things/routes';
import { dependentNames, validateGraph, normalizeData, type ThingRecord } from '../lib/things/model';

export function createPlugin() {
  const denyRemoval = async (id: string) => {
    const names = dependentNames(id, await policyGraph(await getDb()));
    return names.length ? `Reassign the primary folder of ${names.join(', ')} before removing this folder.` : null;
  };
  return definePlugin({
    id: 'liftaris-things', version: '1.0.0',
    capabilities: ['content:read', 'content:write', 'hooks.content-policy:register'],
    admin: { entry: '/src/plugins/things/admin.tsx', pages: [{ path: '/workspace', label: 'Things', icon: 'shapes' }] },
    routes: {
      graph: { public: false, permission: 'content:edit_any', methods: ['GET'], request: { body: 'none' },
        handler: async () => {const db=await getDb();return { things: await policyGraph(db, undefined, true), posts: await postChoices(db) };} },
      validate: { public: false, permission: 'content:edit_any', methods: ['POST'], request: { body: 'json', maxBytes: 1_048_576 },
        handler: async ctx => {
          try {
            const candidate=ctx.input as unknown as ThingRecord;
            if (!candidate || typeof candidate.id!=='string' || typeof candidate.slug!=='string' || !candidate.data || !Array.isArray(candidate.contents) || !candidate.contents.every(id=>typeof id==='string') || (candidate.primaryFolder!==null && typeof candidate.primaryFolder!=='string')) throw new Error('Choose a valid Thing.');
            const db=await getDb();const before=await policyGraph(db);
            const after=[...before.filter(t=>t.id!==candidate.id),{...candidate,status:'published',data:normalizeData(candidate.data)}];
            validateGraph(after);
            if(candidate.data.page_source==='post' && !(await postChoices(db)).some(p=>p.id===candidate.postId)) throw new Error('Choose a Post to display.');
            return {valid:true,changes:routeChanges(before,after)};
          } catch(error) {throw new PluginRouteError('INVALID_THING',error instanceof Error ? error.message : String(error),400);}
        } },
    },
    hooks: {
      'content:beforeSave': async event => {
        if (event.collection !== 'things') return;
        const d = event.content;
        if (typeof d.name === 'string' && !d.name.trim()) throw new ContentSaveRejectedError('Give this Thing a name.');
        if (d.path_override && (typeof d.path_override !== 'string' || !/^\/[a-z0-9][a-z0-9_/-]*$/.test(d.path_override))) throw new ContentSaveRejectedError('Use a lowercase site path.');
      },
      'content:beforePublish': async event => {
        if (event.collection !== 'things') {
          return;
        }
        try {
          const db = await getDb();
          const [after, before] = await Promise.all([
            policyGraph(db, String(event.content.id)),
            policyGraph(db),
          ]);
          validateGraph(after);
          await rememberRoutes(db, before, after);
        }
        catch (error) { return { cancel: true, reason: error instanceof Error ? error.message : 'Invalid Thing relationships.' }; }
      },
      'content:beforeDelete': async event => {
        if (event.collection !== 'things') {
          return true;
        }
        const denied = await denyRemoval(event.id);
        return !denied;
      },
      'content:beforeUnpublish': async event => {
        if (event.collection !== 'things') {
          return;
        }
        const reason = await denyRemoval(String(event.content.id));
        if (reason) return { cancel: true, reason };
      },
    },
  });
}
