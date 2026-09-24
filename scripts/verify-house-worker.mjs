import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../package.json', import.meta.url));
const { buildSync } = require('esbuild');
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const build = buildSync({
  stdin: { contents: `
    import { House as LiveHouse } from './src/server/house/House.ts';
    export class House extends LiveHouse {
      seedLarge() {
        this.ctx.storage.transactionSync(() => {
          for (let i = 0; i < 1100; i++) this.ctx.storage.sql.exec(
            'INSERT INTO gifts VALUES (?, ?, ?, ?, ?, ?, ?)', 'gift-large-'+i, 'popcorn', 'fixture-owner', 'Capybara', '2026-09-24', 'public', 'x'.repeat(2000));
          this.ctx.storage.sql.exec('UPDATE house_state SET revision = revision + 1100');
        });
        return true;
      }
    }
    const viewer = { visitor: { id: 'secret-creator-id', name: 'Capybara' }, owner: false };
    export default { async fetch(request, env) {
      const stub = env.HOUSE.getByName('home');
      const url = new URL(request.url);
      if (url.pathname === '/large') return Response.json(await stub.seedLarge());
      if (url.pathname === '/events') return stub.fetch(request);
      if (request.method === 'GET') return Response.json(await stub.snapshot());
      const input = await request.json();
      if (url.pathname === '/create') return Response.json(await stub.create(input.gift, input.stranger ? { visitor: null, owner: false } : viewer));
      if (url.pathname === '/remove') return Response.json(await stub.remove(input.id, viewer));
      if (url.pathname === '/detail') return Response.json(await stub.detail(input.id, input.stranger ? { visitor: null, owner: false } : viewer));
      return new Response('not found', { status: 404 });
    }};`, resolveDir: root, sourcefile: 'house-smoke.ts' },
  bundle: true, write: false, platform: 'browser', format: 'esm', target: 'es2022',
  external: ['cloudflare:workers'], metafile: true,
});
assert.equal(Object.keys(build.metafile.inputs).some((path) => path.includes('matter-js') || path.includes('matter-engine')), false);
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: build.outputFiles[0].text,
  compatibilityDate: '2026-09-23', compatibilityFlags: ['nodejs_compat'],
  durableObjects: { HOUSE: { className: 'House', useSQLite: true } },
}));
const sockets = [];
const request = async (path, value) => (await mf.dispatchFetch(`http://localhost${path}`, value === undefined ? {} : { method: 'POST', body: JSON.stringify(value) })).json();
const nextEvent = (socket, type) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { socket.removeEventListener(type, receive); reject(new Error(`Timeout waiting for ${type}`)); }, 5000);
  const receive = (event) => { clearTimeout(timeout); resolve(event); };
  socket.addEventListener(type, receive, { once: true });
});
const read = async (event) => JSON.parse((await event).data);
const connect = async () => {
  const response = await mf.dispatchFetch('http://localhost/events?_pk=untrusted', { headers: { Upgrade: 'websocket', 'x-partykit-room': 'evil', 'x-partykit-props': 'bad props', Authorization: 'untrusted' } });
  assert.equal(response.status, 101);
  const socket = response.webSocket;
  socket.accept(); sockets.push(socket); return socket;
};
const sync = async (socket) => {
  const event = nextEvent(socket, 'message');
  socket.send(JSON.stringify({ channel: 'house_collection', sync: true, from: '2999-01-01' }));
  const message = await read(event);
  assert.equal(message.channel, 'house_collection');
  assert.equal(message.sync, true);
  assert.equal(message.payload.length, 1);
  assert.equal(message.payload[0][0], 'home');
  assert.equal(message.payload[0].at(-1), null);
  return JSON.parse(message.payload[0][1]);
};
try {
  assert.deepEqual(await request('/'), { ok: true, value: { revision: 0, gifts: [] } });
  console.log('PASS native RPC initializes before any WebSocket');
  const gift = { requestId: 'one', emojiId: 'popcorn', message: 'private text', visibility: 'private' };
  assert.equal((await request('/create', { gift, stranger: true })).status, 401);
  const created = await request('/create', { gift });
  assert.equal(created.ok, true);
  assert.equal(created.value.gifts[0].message, null);
  const id = created.value.gifts[0].id;
  assert.equal((await request('/detail', { id })).value.message, 'private text');
  assert.equal((await request('/detail', { id, stranger: true })).value.message, null);
  const socket = await connect();
  const publicSnapshot = await sync(socket);
  assert.deepEqual(publicSnapshot, created.value);
  assert.equal(JSON.stringify(publicSnapshot).includes('secret-creator-id'), false);
  assert.equal(JSON.stringify(publicSnapshot).includes('private text'), false);
  console.log('PASS actual partysync full snapshot, redaction and detail auth');
  let update = nextEvent(socket, 'message');
  const second = await request('/create', { gift: { ...gift, requestId: 'two', visibility: 'public', message: 'hello' } });
  let broadcast = await read(update);
  assert.equal(broadcast.broadcast, true);
  assert.equal(broadcast.type, 'update');
  assert.deepEqual(JSON.parse(broadcast.payload[0][1]), second.value);
  update = nextEvent(socket, 'message');
  await request('/remove', { id });
  broadcast = await read(update);
  assert.equal(JSON.parse(broadcast.payload[0][1]).gifts.length, 1);
  socket.close();
  const lastId = second.value.gifts.find((gift) => gift.id !== id).id;
  await request('/remove', { id: lastId });
  const reconnected = await connect();
  assert.deepEqual(await sync(reconnected), { revision: 4, gifts: [] });
  assert.deepEqual((await request('/create', { gift })).value, { revision: 4, gifts: [] });
  console.log('PASS actual partysync broadcasts, offline final deletion and idempotent retry');
  for (const frame of [
    { channel: 'gifts', sync: true },
    { channel: 'house_collection', sync: true, action: { type: 'delete', payload: 'home' } },
    { channel: 'house_collection', rpc: true, action: { type: 'create', payload: {} } },
  ]) {
    const invalid = await connect();
    const closed = nextEvent(invalid, 'close');
    invalid.send(JSON.stringify(frame));
    assert.equal((await closed).code, 1008);
  }
  assert.deepEqual((await request('/')).value, { revision: 4, gifts: [] });
  console.log('PASS private channels and all socket mutations rejected (1008); storage unchanged');
  await request('/large');
  const large = await sync(await connect());
  assert.equal(large.gifts.length, 1100);
  assert.ok(new TextEncoder().encode(JSON.stringify(large)).byteLength > 2 * 1024 * 1024);
  console.log('PASS actual workerd reconnect with a collection larger than 2 MiB');
} finally {
  for (const socket of sockets) try { socket.close(); } catch {}
  await mf.dispose();
}