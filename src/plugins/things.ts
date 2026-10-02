import { definePlugin, ContentSaveRejectedError, PluginRouteError } from 'emdash';
import { getDb } from 'emdash/runtime';
import { policyGraph } from '../server/things/graph';
import { rememberRoutes, routeChanges } from '../server/things/routes';
import { dependentNames, validateGraph } from '../lib/things/model';

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
        handler: async () => ({ things: await policyGraph(await getDb(), undefined, true) }) },
      validate: { public: false, permission: 'content:edit_any', methods: ['GET'], request: { body: 'none' },
        handler: async ctx => {
          const id = new URL(ctx.request.url).searchParams.get('id');
          if (!id) throw new PluginRouteError('INVALID_ID', 'Choose a Thing.', 400);
          try { const db=await getDb();const after=await policyGraph(db,id);validateGraph(after); return { valid: true, changes:routeChanges(await policyGraph(db),after) }; }
          catch (error) { throw new PluginRouteError('INVALID_THING', String(error instanceof Error ? error.message : error), 400); }
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
        if (event.collection !== 'things') return;
        try { const db=await getDb();const after=await policyGraph(db,String(event.content.id));validateGraph(after);await rememberRoutes(db,await policyGraph(db),after); }
        catch (error) { return { cancel: true, reason: error instanceof Error ? error.message : 'Invalid Thing relationships.' }; }
      },
      'content:beforeDelete': async event => event.collection !== 'things' || !await denyRemoval(event.id),
      'content:beforeUnpublish': async event => {
        if (event.collection !== 'things') return;
        const reason = await denyRemoval(String(event.content.id));
        if (reason) return { cancel: true, reason };
      },
    },
  });
}
