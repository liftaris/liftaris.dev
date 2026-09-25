import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../package.json', import.meta.url));
const { buildSync } = require('esbuild');
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');

// No Astro/Wrangler config, dotenv, remote bindings, credentials or persistent data.
const build = buildSync({
  absWorkingDir: root, entryPoints: ['scripts/fixtures/house-d1-worker.ts'],
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022',
  // Astro-only dynamic imports are not part of these repository/store calls.
  external: ['cloudflare:workers', 'virtual:emdash/*', 'astro:content'],
  loader: { '.sql': 'text', '.wasm': 'binary' }, metafile: true,
});
assert.equal(Object.keys(build.metafile.inputs).some((path) =>
  /(?:partysync|partyserver|partysocket|matter-js|matter-engine)/.test(path)), false);
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: build.outputFiles[0].text,
  compatibilityDate: '2026-09-23', compatibilityFlags: ['nodejs_compat'],
  host: '127.0.0.1', port: 0,
  d1Databases: { TEST_DB: 'house-verifier-test-only' }, d1Persist: false,
  outboundService: () => new Response('Network disabled in house verifier', { status: 502 }),
}));
const request = async (path, input, status = 200) => {
  const response = await mf.dispatchFetch(`http://house-test.invalid${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input ?? {}),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await response.json();
  assert.equal(response.status, status, `${path}: ${JSON.stringify(body)}`);
  assert.equal(body.ok, status === 200, `${path}: ${JSON.stringify(body)}`);
  return body.value;
};

try {
  const initial = await request('/initialize');
  assert.ok(initial.migrations.applied.length > 0);
  assert.deepEqual(initial.migrations.applied, initial.expectedMigrations);
  assert.deepEqual(initial.repeat.applied, []);
  assert.deepEqual(initial.migrationStatus.pending, []);
  assert.deepEqual(initial.migrationStatus.unknownApplied, []);
  assert.deepEqual(initial.migrationStatus.knownApplied, initial.expectedMigrations);
  assert.deepEqual(await request('/snapshot'), { gifts: [] });
  assert.deepEqual(initial.collection.supports, []);
  assert.equal(initial.collection.routable, false);
  assert.ok(initial.fields.length > 0);
  assert.ok(initial.fields.every((field) => field.searchable === false));
  console.log(`PASS actual EmDash D1 migrations (${initial.migrations.applied.length}), repeat initialization and non-searchable CMS gift collection`);

  const d1 = await mf.getD1Database('TEST_DB');
  const row = async (query, ...parameters) => d1.prepare(query).bind(...parameters).first();
  const sender = initial.users.find((user) => user.key === 'sender');
  const other = initial.users.find((user) => user.key === 'other');
  const quotaUser = initial.users.find((user) => user.key === 'quota');
  assert.equal(sender.data.anonymous, true);
  assert.equal(sender.role, 10);
  assert.equal(other.data.anonymous, true);
  const trigger = await row("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'house_gift_receipt'");
  assert.match(trigger.sql, /BEFORE INSERT ON ec_gifts/);

  const gift = { requestId: 'one', emojiId: 'popcorn', message: 'Test-only private note', visibility: 'private' };
  await request('/create', { gift, viewer: 'stranger' }, 401);
  await request('/create', { gift: { ...gift, emojiId: 'bogus' } }, 400);
  await request('/create', { gift: { ...gift, requestId: 'bad/id' } }, 400);
  const concurrent = await Promise.all(Array.from({ length: 4 }, () => request('/create', { gift })));
  const created = concurrent[0];
  const id = created.createdGiftId;
  assert.ok(id);
  assert.ok(concurrent.every((result) => result.createdGiftId === id && result.gifts.length === 1));
  assert.deepEqual(await request('/create', { gift }), created);
  await request('/create', { gift: { ...gift, message: 'different request payload' } }, 409);
  const record = await request('/cms-record', { id });
  assert.equal(record.authorId, sender.id);
  assert.equal(record.status, 'published');
  assert.equal(record.data.message, gift.message);
  const receipt = await row('SELECT * FROM house_gift_receipts WHERE id = ?', id);
  assert.deepEqual(Object.keys(receipt).sort(), ['author_id', 'fingerprint', 'id']);
  assert.equal(receipt.author_id, sender.id);
  assert.equal(receipt.fingerprint, record.data.submission_hash);
  assert.equal((await row('SELECT COUNT(*) AS count FROM house_gift_receipts')).count, 1);
  assert.equal((await row('SELECT COUNT(*) AS count FROM ec_gifts')).count, 1);
  console.log('PASS CMS anonymous ownership, concurrent create/retry deduplication and 409 payload conflicts');

  // Drive the installed BEFORE INSERT trigger directly, not a mocked receipt repository.
  const rawGift = await row('SELECT * FROM ec_gifts WHERE id = ?', id);
  const insert = (overrides) => {
    const values = { ...rawGift, ...overrides };
    const columns = Object.keys(values);
    return d1.prepare(`INSERT INTO ec_gifts (${columns.map((column) => `"${column}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`)
      .bind(...Object.values(values));
  };
  await assert.rejects(insert({}).run(), /gift_already_submitted/);
  await assert.rejects(insert({ id: 'failed-atomic-insert', emoji_id: null }).run(), /NOT NULL constraint failed: ec_gifts.emoji_id/);
  assert.equal(await row('SELECT * FROM house_gift_receipts WHERE id = ?', 'failed-atomic-insert'), null);
  assert.equal(await row('SELECT * FROM ec_gifts WHERE id = ?', 'failed-atomic-insert'), null);
  console.log('PASS D1 BEFORE INSERT receipt uniqueness and atomic rollback on rejected content insertion');

  const publicKeys = ['authorName', 'createdAt', 'emojiId', 'id', 'message', 'visibility'].sort();
  assert.deepEqual(Object.keys(created.gifts[0]).sort(), publicKeys);
  const noSecrets = (value) => {
    const serialized = JSON.stringify(value);
    for (const secret of [gift.message, sender.id, sender.email, receipt.fingerprint, 'submission_hash', 'author_id', 'authorId']) {
      assert.equal(serialized.includes(secret), false, `Public projection leaked ${secret}`);
    }
  };
  noSecrets(created);
  noSecrets(await request('/snapshot'));
  for (const viewer of ['other', 'stranger']) {
    const detail = await request('/detail', { id, viewer });
    noSecrets(detail);
    assert.equal(detail.message, null);
    assert.equal(detail.canEdit, false);
    assert.equal(detail.canReclaim, false);
    assert.equal(detail.canRemove, false);
  }
  const ownDetail = await request('/detail', { id });
  assert.equal(ownDetail.message, gift.message);
  assert.equal(ownDetail.canEdit, true);
  assert.equal(ownDetail.canReclaim, true);
  assert.equal(ownDetail.canRemove, false);
  const ownerDetail = await request('/detail', { id, viewer: 'owner' });
  assert.equal(ownerDetail.message, gift.message);
  assert.equal(ownerDetail.canEdit, true);
  assert.equal(ownerDetail.canReclaim, false);
  assert.equal(ownerDetail.canRemove, true);
  console.log('PASS private snapshots/detail redact messages, CMS identity and receipt metadata; sender/owner detail is authorized');

  await request('/update', { id, gift, viewer: 'stranger' }, 401);
  await request('/update', { id, gift: { ...gift, message: 'stolen' }, viewer: 'other' }, 403);
  await request('/remove', { id, viewer: 'stranger' }, 401);
  await request('/remove', { id, viewer: 'other' }, 403);
  assert.equal((await request('/detail', { id })).message, gift.message);
  for (const invalid of [{ emojiId: 'bogus' }, { message: 'x'.repeat(2001) }, { displayName: 'x'.repeat(61) }]) {
    await request('/update', { id, gift: { ...gift, ...invalid } }, 400);
  }
  const edited = await request('/update', { id, gift: {
    ...gift, message: 'Public edit', visibility: 'public', displayName: 'Test sender',
    authorId: other.id, author_id: other.id, status: 'draft', collection: 'posts',
  } });
  assert.equal(edited.gifts[0].message, 'Public edit');
  assert.equal(edited.gifts[0].authorName, 'Test sender');
  assert.equal((await request('/cms-record', { id })).authorId, sender.id);
  assert.equal((await request('/cms-record', { id })).status, 'published');
  assert.deepEqual(await row('SELECT * FROM house_gift_receipts WHERE id = ?', id), receipt);
  assert.equal((await request('/create', { gift })).createdGiftId, id);
  assert.equal((await request('/detail', { id })).message, 'Public edit');
  await request('/update', { id, gift: { ...gift, message: 'Owner private edit' }, viewer: 'owner' });
  assert.equal((await request('/snapshot')).gifts[0].message, null);
  assert.equal((await request('/detail', { id })).message, 'Owner private edit');
  assert.equal((await request('/cms-record', { id })).authorId, sender.id);
  await request('/cms-update', { id, change: { data: { message: 'Edited directly in CMS', visibility: 'public' } } });
  assert.equal((await request('/snapshot')).gifts[0].message, 'Edited directly in CMS');
  await request('/cms-update', { id, change: { status: 'draft' } });
  assert.deepEqual(await request('/snapshot'), { gifts: [] });
  await request('/detail', { id }, 404);
  await request('/cms-update', { id, change: { status: 'published' } });
  console.log('PASS sender-only edits/withdrawal, owner moderation, immutable ownership, validation and authoritative CMS changes');

  const otherCreated = await request('/create', { gift, viewer: 'other' });
  assert.notEqual(otherCreated.createdGiftId, id);
  assert.equal(otherCreated.gifts.length, 2);
  const withdrawn = await request('/remove', { id });
  assert.equal(withdrawn.gifts.length, 1);
  await request('/detail', { id }, 404);
  assert.deepEqual(await request('/remove', { id }), withdrawn);
  assert.ok((await row('SELECT deleted_at FROM ec_gifts WHERE id = ?', id)).deleted_at);
  assert.equal((await request('/create', { gift })).createdGiftId, null);
  assert.equal(await request('/cms-permanent-delete', { id }), true);
  assert.equal(await request('/cms-record', { id }), null);
  assert.deepEqual(await row('SELECT * FROM house_gift_receipts WHERE id = ?', id), receipt);
  assert.deepEqual(await request('/restart'), withdrawn);
  assert.equal((await request('/create', { gift })).createdGiftId, null);
  await request('/create', { gift: { ...gift, message: 'resurrection attempt' } }, 409);
  await assert.rejects(insert({}).run(), /gift_already_submitted/);
  assert.equal(await row('SELECT * FROM ec_gifts WHERE id = ?', id), null);
  assert.deepEqual(await request('/remove', { id: otherCreated.createdGiftId, viewer: 'owner' }), { gifts: [] });
  console.log('PASS per-user request IDs, repeat withdrawal and permanent-delete tombstones survive store reconstruction');

  const quota = { key: 'test:atomic-quota', maximum: 10, windowSeconds: 60, now: Date.UTC(2026, 0, 1) };
  const quotaResults = await Promise.all(Array.from({ length: 20 }, () => request('/quota', quota)));
  assert.equal(quotaResults.filter(Boolean).length, 10);
  assert.equal(quotaResults.filter((allowed) => !allowed).length, 10);
  assert.equal(await request('/quota', { ...quota, now: quota.now + 59_999 }), false);
  assert.equal(await request('/quota', { ...quota, now: quota.now + 60_000 }), true);
  assert.equal(await request('/quota', { ...quota, key: 'test:other-quota' }), true);

  const firstQuotaGift = { ...gift, requestId: 'quota-first', message: 'Quota fixture', visibility: 'public' };
  const quotaCreated = await request('/create', { gift: firstQuotaGift, viewer: 'quota' });
  // Fill adjacent real-time windows so a minute boundary cannot make this flaky.
  const currentWindow = Math.floor(Date.now() / 60_000) * 60_000;
  for (const offset of [-60_000, 0, 60_000, 120_000]) {
    await d1.prepare('INSERT INTO _emdash_rate_limits (key, "window", count) VALUES (?, ?, 10) ON CONFLICT (key, "window") DO UPDATE SET count = 10')
      .bind(`house:gifts:${quotaUser.id}`, new Date(currentWindow + offset).toISOString()).run();
  }
  await request('/create', { gift: { ...gift, requestId: 'quota-denied' }, viewer: 'quota' }, 429);
  assert.deepEqual(await request('/create', { gift: firstQuotaGift, viewer: 'quota' }), quotaCreated);
  await request('/update', { id: quotaCreated.createdGiftId, gift: firstQuotaGift, viewer: 'quota' });
  await request('/remove', { id: quotaCreated.createdGiftId, viewer: 'quota' });
  assert.equal((await request('/create', { gift: firstQuotaGift, viewer: 'quota' })).createdGiftId, null);
  const ownerGifts = [];
  for (let i = 0; i < 11; i++) ownerGifts.push(await request('/create', { gift: { ...gift, requestId: `owner-${i}` }, viewer: 'owner' }));
  assert.ok(ownerGifts.every((result) => result.createdGiftId));
  console.log('PASS atomic concurrent D1 quotas, window expiry/isolation, 429, retry/edit/delete access and owner exemption');

  // Populate beyond one CMS page with local D1 fixtures; every read is the real store.
  const paginationCount = 105;
  for (let offset = 0; offset < paginationCount; offset += 25) {
    await d1.batch(Array.from({ length: Math.min(25, paginationCount - offset) }, (_, i) => insert({
      id: `pagination-${String(offset + i).padStart(3, '0')}`, submission_hash: null,
      message: 'Public pagination fixture', visibility: 'public',
    })));
  }
  const fullSnapshot = await request('/snapshot');
  assert.equal(fullSnapshot.gifts.length, ownerGifts.length + paginationCount);
  assert.equal(new Set(fullSnapshot.gifts.map((item) => item.id)).size, fullSnapshot.gifts.length);
  assert.equal(fullSnapshot.gifts.filter((item) => item.id.startsWith('pagination-')).length, paginationCount);
  assert.ok(fullSnapshot.gifts.every((item) => Object.keys(item).sort().join() === publicKeys.join()));
  noSecrets(fullSnapshot);
  console.log('PASS multi-page D1/CMS snapshot includes every published gift exactly once without private fields');
} finally {
  await mf.dispose();
}
console.log('PASS local Miniflare disposed; no live database used');
